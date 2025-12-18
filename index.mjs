import crypto from 'crypto';

// KONFIGURACJA ZMIENNYCH
const GITHUB_SECRET = process.env.GITHUB_SECRET; 
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export const handler = async (event) => {
    try {
        // 1. WERYFIKACJA BEZPIECZEŃSTWA
        const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
        const body = event.body;

        if (!verifySignature(signature, body, GITHUB_SECRET)) {
            return { statusCode: 401, body: 'Błąd weryfikacji podpisu' };
        }

        const payload = JSON.parse(body);
        const eventType = event.headers['x-github-event'] || event.headers['X-GitHub-Event'];

        console.log(`Otrzymano zdarzenie: ${eventType}`);

        // 2. ROUTING ZDARZEŃ
        let discordMessage = null;

        switch (eventType) {
            case 'push':
                discordMessage = handlePush(payload);
                break;
            case 'issues':
                discordMessage = handleIssue(payload);
                break;
            case 'pull_request':
                discordMessage = handlePullRequest(payload);
                break;
            case 'issue_comment': // Zwykły komentarz ogólny
                discordMessage = handleComment(payload);
                break;
            case 'pull_request_review_comment': // NOWOŚĆ: Komentarz do konkretnej linii kodu
                discordMessage = handleReviewComment(payload);
                break;
            case 'release':
                discordMessage = handleRelease(payload);
                break;
            case 'watch':
                discordMessage = handleStar(payload);
                break;
            case 'ping':
                discordMessage = { content: "✅ Webhook GitHuba połączony pomyślnie!" };
                break;
            default:
                console.log(`Pominięto zdarzenie: ${eventType}`);
                return { statusCode: 200, body: 'Ignored' };
        }

        // 3. WYSYŁKA
        if (discordMessage) {
            await sendToDiscord(discordMessage);
        }

        return { statusCode: 200, body: 'OK' };

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};

// --- LOGIKA BIZNESOWA (Tworzenie wiadomości) ---

// 1. Obsługa PUSH
function handlePush(payload) {
    const { ref, commits, repository, sender, forced } = payload;
    if (!commits || commits.length === 0) return null;

    const branch = ref.replace('refs/heads/', '');
    const commitCount = commits.length;
    
    let description = commits.slice(0, 5).map(c => {
        const msg = c.message.split('\n')[0];
        return `[\`${c.id.substring(0, 7)}\`](${c.url}) - ${msg} - *${c.author.name}*`;
    }).join('\n');

    if (commitCount > 5) description += `\n...i ${commitCount - 5} więcej.`;
    if (forced) description = `⚠️ **FORCE PUSH** (Historia nadpisana!)\n\n` + description;

    return {
        embeds: [{
            title: `[Push] ${commitCount} nowych commitów do \`${branch}\``,
            url: payload.compare,
            description: description,
            color: forced ? 0xff0000 : 0x7289da,
            timestamp: new Date().toISOString(),
            author: { name: sender.login, icon_url: sender.avatar_url, url: sender.html_url },
            footer: { text: repository.full_name, icon_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" }
        }]
    };
}

// 2. Obsługa ISSUES
function handleIssue(payload) {
    const { action, issue, repository, sender } = payload;
    if (!['opened', 'closed', 'reopened'].includes(action)) return null;

    const colors = { opened: 0x2ecc71, closed: 0xe74c3c, reopened: 0xe67e22 };
    const actionPL = { opened: 'Zgłosił(a)', closed: 'Zamknął(ęła)', reopened: 'Wznowił(a)' };

    return {
        embeds: [{
            author: { name: `${sender.login} ${actionPL[action]} Issue #${issue.number}`, icon_url: sender.avatar_url },
            title: issue.title,
            url: issue.html_url,
            description: issue.body ? (issue.body.length > 200 ? issue.body.substring(0, 200) + '...' : issue.body) : '*Brak opisu*',
            color: colors[action] || 0x95a5a6,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Repozytorium", value: repository.full_name, inline: true },
                { name: "Etykiety", value: issue.labels.map(l => l.name).join(', ') || 'Brak', inline: true }
            ],
            footer: { text: "GitHub Issues" }
        }]
    };
}

// 3. Obsługa PULL REQUEST
function handlePullRequest(payload) {
    const { action, pull_request, repository, sender } = payload;
    if (!['opened', 'closed', 'reopened'].includes(action)) return null;

    let status = action === 'opened' ? 'Otworzył(a)' : 'Zamknął(ęła)';
    let color = 0x3498db; 

    if (action === 'closed' && pull_request.merged) {
        status = 'Zmergował(a)';
        color = 0x9b59b6; 
    } else if (action === 'closed' && !pull_request.merged) {
        color = 0x992d22; 
    }

    return {
        embeds: [{
            author: { name: `${sender.login} ${status} Pull Request #${pull_request.number}`, icon_url: sender.avatar_url },
            title: pull_request.title,
            url: pull_request.html_url,
            color: color,
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Gałęzie", value: `\`${pull_request.head.ref}\` ➡️ \`${pull_request.base.ref}\``, inline: false },
                { name: "Zmiany", value: `➕ ${pull_request.additions} | ➖ ${pull_request.deletions} | 📄 ${pull_request.changed_files}`, inline: true }
            ],
            footer: { text: repository.full_name }
        }]
    };
}

// 4. Obsługa REVIEW COMMENTS (Komentarze do kodu)
function handleReviewComment(payload) {
    const { action, comment, pull_request, repository, sender } = payload;
    if (action !== 'created') return null;

    // Pobieramy fragment diffa (kodu), którego dotyczy komentarz
    let diffSnippet = comment.diff_hunk;
    // Skracamy diffa jeśli jest za długi, żeby nie zaśmiecić czatu
    if (diffSnippet.length > 300) diffSnippet = diffSnippet.substring(0, 300) + '...';

    return {
        embeds: [{
            title: `👀 Code Review w PR #${pull_request.number}`,
            url: comment.html_url,
            description: `**Komentarz:** ${comment.body}`,
            color: 0xe67e22, // Ciemny pomarańczowy (wyróżnia się od zwykłych komentarzy)
            timestamp: new Date().toISOString(),
            author: {
                name: `${sender.login} skomentował(a) linię kodu`,
                icon_url: sender.avatar_url,
                url: sender.html_url
            },
            fields: [
                { name: "📂 Plik", value: `\`${comment.path}\``, inline: false },
                { name: "💻 Kod", value: `\`\`\`diff\n${diffSnippet}\n\`\`\``, inline: false }
            ],
            footer: { text: repository.full_name }
        }]
    };
}

// 5. Obsługa ZWYKŁYCH KOMENTARZY (Ogólne dyskusje)
function handleComment(payload) {
    const { action, comment, issue, repository, sender } = payload;
    if (action !== 'created') return null;
    const type = issue.pull_request ? "PR" : "Issue";

    return {
        embeds: [{
            author: { name: `${sender.login} skomentował ${type} #${issue.number}`, icon_url: sender.avatar_url, url: comment.html_url },
            description: comment.body.length > 300 ? comment.body.substring(0, 300) + '...' : comment.body,
            color: 0xf1c40f, // Żółty
            timestamp: new Date().toISOString(),
            footer: { text: repository.full_name }
        }]
    };
}

// 6. Obsługa RELEASE
function handleRelease(payload) {
    const { action, release, repository, sender } = payload;
    if (action !== 'published') return null;

    return {
        embeds: [{
            title: `🚀 Nowa wersja: ${release.tag_name}`,
            url: release.html_url,
            description: `**${release.name || ''}**\n\n${release.body ? release.body.substring(0, 500) : ''}`,
            color: 0xffd700, 
            thumbnail: { url: repository.owner.avatar_url },
            timestamp: new Date().toISOString(),
            author: { name: `Release Manager: ${sender.login}`, icon_url: sender.avatar_url },
            footer: { text: "Produkcja" }
        }]
    };
}

// 7. Obsługa WATCH (Gwiazdki)
function handleStar(payload) {
    const { action, repository, sender } = payload;
    if (action !== 'started') return null;

    return {
        embeds: [{
            title: `🌟 Nowa gwiazdka!`,
            description: `**${sender.login}** polubił repozytorium.`,
            color: 0xFFFF00, 
            thumbnail: { url: sender.avatar_url },
            fields: [{ name: "Liczba gwiazdek", value: `${repository.stargazers_count} ⭐`, inline: true }],
            url: repository.html_url
        }]
    };
}

// --- NARZĘDZIA ---

async function sendToDiscord(message) {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });
    if (!response.ok) throw new Error(`Discord API Error: ${response.status}`);
}

function verifySignature(signature, body, secret) {
    if (!signature || !body || !secret) return false;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}