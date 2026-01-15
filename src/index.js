// Load environment variables locally if .env file exists
require('dotenv').config();

const fs = require('fs');
// Although Node 18+ has native fetch, we import it to satisfy dependencies requirement
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.error("❌ ERROR: Missing DISCORD_WEBHOOK_URL environment variable.");
        process.exit(1);
    }

    const eventPath = process.env.GITHUB_EVENT_PATH;
    const eventName = process.env.GITHUB_EVENT_NAME;

    if (!eventPath) {
        console.error("❌ ERROR: Missing GITHUB_EVENT_PATH environment variable.");
        process.exit(1);
    }

    const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    let embed = null;

    console.log(`➡️ Handling event: ${eventName}`);

    const translateAction = (action) => {
        const dict = {
            'opened': 'Opened', 'closed': 'Closed', 'reopened': 'Reopened',
            'created': 'Created', 'edited': 'Edited', 'deleted': 'Deleted',
            'submitted': 'Submitted'
        };
        return dict[action] || action;
    };
    
    const ghIcon = "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";

    if (eventName === 'issues') {
        const { action, issue, repository, sender } = payload;
        const colors = { opened: 0x2ecc71, closed: 0xe74c3c, reopened: 0xe67e22 };
        
        const labels = issue.labels ? issue.labels.map(l => l.name).join(', ') : 'None';
        const assignees = issue.assignees ? issue.assignees.map(u => u.login).join(', ') : 'None';

        embed = {
            title: `[Issue] ${issue.title}`,
            url: issue.html_url,
            description: issue.body ? (issue.body.length > 300 ? issue.body.substring(0, 300) + '...' : issue.body) : '*No description*',
            color: colors[action] || 0x95a5a6,
            timestamp: new Date().toISOString(),
            author: { name: `${sender.login} ${translateAction(action)} issue #${issue.number}`, icon_url: sender.avatar_url, url: sender.html_url },
            fields: [
                { name: "Repository", value: repository.full_name, inline: true },
                { name: "Labels", value: `\`${labels}\``, inline: true },
                { name: "Assignees", value: assignees, inline: true }
            ],
            footer: { text: "GitHub Issues • " + action.toUpperCase(), icon_url: ghIcon }
        };
    }

    else if (eventName === 'pull_request') {
        const { action, pull_request, repository, sender } = payload;
        let statusText = translateAction(action);
        let color = 0x3498db; 

        if (action === 'closed') {
            if (pull_request.merged) {
                statusText = 'Merged';
                color = 0x9b59b6; 
            } else {
                statusText = 'Rejected / Closed';
                color = 0x992d22; 
            }
        }

        embed = {
            title: `[PR] ${pull_request.title}`,
            url: pull_request.html_url,
            color: color,
            timestamp: new Date().toISOString(),
            author: { name: `${sender.login} ${statusText} PR #${pull_request.number}`, icon_url: sender.avatar_url, url: sender.html_url },
            fields: [
                { name: "Repository", value: repository.full_name, inline: true },
                { name: "Branches", value: `\`${pull_request.head.ref}\` ➡️ \`${pull_request.base.ref}\``, inline: false },
                { name: "Changes", value: `➕ ${pull_request.additions} | ➖ ${pull_request.deletions} | 📄 ${pull_request.changed_files}`, inline: true }
            ],
            footer: { text: "GitHub PR • " + repository.name, icon_url: ghIcon }
        };
    }

    else if (eventName === 'pull_request_review') {
        const { review, pull_request, repository, sender } = payload;
        const state = review.state; 
        let color = 0x95a5a6; 
        let titlePrefix = "Commented on";
        
        if (state === 'APPROVED') {
            color = 0x2ecc71; titlePrefix = "✅ Approved";
        } else if (state === 'CHANGES_REQUESTED') {
            color = 0xe74c3c; titlePrefix = "🛑 Requested changes on";
        }

        embed = {
            title: `${titlePrefix} PR #${pull_request.number}`,
            url: review.html_url,
            description: `**${pull_request.title}**\n\n${review.body || ""}`,
            color: color,
            timestamp: new Date().toISOString(),
            author: { name: sender.login, icon_url: sender.avatar_url, url: sender.html_url },
            footer: { text: repository.full_name, icon_url: ghIcon }
        };
    }

    else if (eventName === 'push') {
        const { ref, commits, repository, sender, forced, compare } = payload;
        if (commits && commits.length > 0) {
            const branch = ref.replace('refs/heads/', '');
            let desc = commits.slice(0, 5).map(c => {
                const msg = c.message.split('\n')[0];
                return `[\`${c.id.substring(0, 7)}\`](${c.url}) - ${msg} - *${c.author.name}*`;
            }).join('\n');
            if (commits.length > 5) desc += `\n...and ${commits.length - 5} more.`;
            if (forced) desc = `⚠️ **FORCE PUSH** (History overwritten!)\n\n` + desc;
            
            embed = {
                title: `[Push] ${commits.length} new commits to \`${branch}\``,
                url: compare, description: desc, color: forced ? 0xff0000 : 0x7289da,
                timestamp: new Date().toISOString(),
                author: { name: sender.login, icon_url: sender.avatar_url, url: sender.html_url },
                footer: { text: repository.full_name, icon_url: ghIcon }
            };
        }
    }

    else if (eventName === 'pull_request_review_comment') {
        const { comment, pull_request, repository, sender } = payload;
        let diff = comment.diff_hunk;
        if (diff.length > 300) diff = diff.substring(0, 300) + '...';

        embed = {
            title: `👀 Code Review in PR #${pull_request.number}`,
            url: comment.html_url,
            description: `**Comment:** ${comment.body}`,
            color: 0xe67e22, timestamp: new Date().toISOString(),
            author: { name: `${sender.login} on code`, icon_url: sender.avatar_url },
            fields: [
                { name: "File", value: `\`${comment.path}\``, inline: false },
                { name: "Code", value: `\`\`\`diff\n${diff}\n\`\`\``, inline: false }
            ],
            footer: { text: repository.full_name, icon_url: ghIcon }
        };
    }

    else if (eventName === 'issue_comment') {
        const { comment, issue, repository, sender } = payload;
        const type = issue.pull_request ? "PR" : "Issue";
        embed = {
            title: `💬 Comment in ${type} #${issue.number}`,
            url: comment.html_url, description: comment.body.substring(0, 300), color: 0xf1c40f, timestamp: new Date().toISOString(),
            author: { name: sender.login, icon_url: sender.avatar_url, url: sender.html_url },
            footer: { text: repository.full_name, icon_url: ghIcon }
        };
    }
    else if (eventName === 'release') { 
        const { release, repository, sender } = payload;
        embed = { 
            title: `🚀 New Release: ${release.tag_name}`, url: release.html_url, description: release.name, color: 0xffd700, 
            thumbnail: { url: repository.owner.avatar_url }, author: { name: sender.login, icon_url: sender.avatar_url }, timestamp: new Date().toISOString()
        }; 
    }
    else if (eventName === 'watch') { 
        const { repository, sender } = payload;
        embed = { 
            title: `🌟 New Star!`, color: 0xFFFF00, author: { name: sender.login, icon_url: sender.avatar_url },
            fields: [{name: "Stars", value: `${repository.stargazers_count} ⭐`}], url: repository.html_url
        }; 
    }

    if (embed) {
        console.log("✅ Successfully generated embed. Sending...");
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    } else {
        console.log("ℹ️ No logic matched for this event or no data to send.");
    }
}

run().catch(err => {
    console.error("❌ Critical Error:", err);
    process.exit(1);
});