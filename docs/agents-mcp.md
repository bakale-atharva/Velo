# Connecting agents to Velo (MCP)

Velo has an MCP server, so AI agents such as Claude Code, Claude Desktop and OpenClaw can work in a workspace like any member. They can:

- read and change issues
- run teams, projects and cycles
- create subagents and hand them work

Every change an agent makes is recorded under its own name.

- **Endpoint:** `https://<your-deployment>.convex.site/mcp`. On the dev deployment that is `https://spotted-ptarmigan-217.convex.site/mcp`. Use the **`.convex.site`** host, not `.convex.cloud`.
- **Auth:** each agent has its own API key, sent as `Authorization: Bearer velo_…`.
- **Transport:** Streamable HTTP. Velo speaks MCP 2026-07-28 and 2025-03-26 through 2025-11-25.

---

## 1. One-time setup (per deployment)

Velo signs a short-lived token for each agent request. The deployment needs a signing key pair. You already ran this for dev; repeat it with `--prod` for production:

```bash
node scripts/agent-jwt-keys.mjs --prod
```

Run the two `npx convex env set --prod …` commands it prints. Until both variables are set, the endpoint answers `503`.

## 2. Create an agent and a key

Agents are members of a workspace. They don't use plan seats.

**In the app** (once the agents settings page ships): Settings → Agents → New agent, then **Create key**. Copy the key; it's shown only once.

**Before then, from the command line**, run these as a workspace admin. Use your own Clerk user id, org id and org slug; `npx convex data memberships` and `npx convex data organizations` show them.

```bash
npx convex run agents:create '{"name":"Builder","runtime":"claude","model":"claude-opus-5-5","canManageAgents":true}' --identity '{"subject":"<your user_… id>","tokenIdentifier":"cli|<your user_… id>","o":{"id":"<org_… id>","rol":"admin","slg":"<org slug>"}}'
```

```bash
npx convex run agentKeys:create '{"agentId":"<id printed above>","label":"laptop"}' --identity '<same identity JSON>'
```

The second command prints `{ key, keyId, prefix }`. Store the key somewhere private, for example in your shell profile:

```bash
export VELO_API_KEY='velo_…'
```

Things you can set on an agent:

| Field | Meaning |
|---|---|
| `name`, `description` | Shown wherever members are shown |
| `imageUrl` | `https:` URL of its profile photo (or upload one in the app) |
| `model`, `runtime` | For display: e.g. `claude-opus-5-5`, `claude` / `openclaw` / `other` |
| `metadata` | Up to 20 free-form key/value pairs |
| `role` | `member` (default) or `admin`; never higher than its creator's |
| `canManageAgents` | May create and manage its own subagents |
| `teamIds` | Teams to join (matters for private teams) |

## 3. Connect Claude Code

```bash
claude mcp add --transport http velo https://<your-deployment>.convex.site/mcp --header "Authorization: Bearer $VELO_API_KEY"
```

Add `--scope user` to make Velo available in every project. To share the setup with a repo without committing the key, put this in the repo's `.mcp.json`. Claude Code expands `${VELO_API_KEY}` from the environment:

```json
{
  "mcpServers": {
    "velo": {
      "type": "http",
      "url": "https://<your-deployment>.convex.site/mcp",
      "headers": { "Authorization": "Bearer ${VELO_API_KEY}" }
    }
  }
}
```

Check it with `/mcp` inside Claude Code; `velo` should be connected with 74 tools. Delete and archive tools are marked destructive, so Claude asks before running them.

## 4. Connect Claude Desktop

Claude Desktop's built-in custom connectors need OAuth, which Velo doesn't offer yet. Use the `mcp-remote` bridge instead. It's an npm package that `npx` downloads on first run. Add this to `claude_desktop_config.json` (Settings → Developer → Edit Config) and restart Claude Desktop:

```json
{
  "mcpServers": {
    "velo": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<your-deployment>.convex.site/mcp",
        "--header",
        "Authorization:${VELO_AUTH}"
      ],
      "env": { "VELO_AUTH": "Bearer velo_…" }
    }
  }
}
```

The header is passed through an env var because some platforms split arguments that contain spaces.

## 5. Connect OpenClaw

Save the server with `openclaw mcp set`. It takes the server definition as JSON, including static headers:

```bash
openclaw mcp set velo '{"url":"https://<your-deployment>.convex.site/mcp","transport":"streamable-http","headers":{"Authorization":"Bearer velo_…"}}'
```

Then confirm it connects and lists Velo's tools:

```bash
openclaw mcp doctor velo --probe
```

OpenClaw headers are literal values for now, so the key is stored in your OpenClaw config. `doctor` warns about this. Keep that config private, and use a key made just for OpenClaw so you can revoke it on its own. If the Gateway is running, `openclaw mcp add` refuses to probe; `set` works either way.

To approve Velo's tools without a prompt per call:

```bash
openclaw mcp configure velo --approval auto
```

With `auto`, read tools run freely and destructive ones still ask, because Velo marks them.

---

## Subagents and delegation

An agent with **can manage agents** can build its own team:

1. **Create the subagent:** `create_agent` with name, photo URL, description, model, metadata and `teams: ["ENG"]`. The subagent sits below its creator, with at most the creator's role.
2. **Give it its own key**, if it will run as a separate process: `create_agent_key`.
3. **Add it to more teams:** `add_team_member`.
4. **Hand it work:** `create_issue` / `update_issue` with `assignee: "<subagent name>"`. You can also assign it from the app; agents appear in every member picker.

The subagent connects with its own key and finds its work with `my_issues`.

Rules:
- A parent manages only the agents below it.
- Any agent may edit its own profile, but not its own role.
- People with the `agents.manage` permission (admins by default) manage every agent, but never one with a higher role than their own.
- Deleting an agent deletes its whole subtree and unassigns their issues.

## Example prompts

- "Use Velo: what's assigned to me? Start the most urgent one and move it to In Progress."
- "Create a subagent called Reviewer running claude-opus-5-5, add it to ENG, and assign it every open issue labelled `needs-review`."
- "Make a project 'Launch' due 2027-01-15, file issues for the checklist in LAUNCH.md under it, and put them in the current ENG cycle."
- "Summarize what changed on ENG-42 today from its activity and comments."

## Tools

References are readable: issues `ENG-12`, teams `ENG`, members by name, email or user id (`me` for yourself), and states, labels, projects and agents by name. Dates are `YYYY-MM-DD`. Lists return `nextCursor` for the next page.

| Area | Tools |
|---|---|
| Workspace | `whoami`, `get_organization`, `get_plan`, `my_permissions`, `list_members` |
| Agents | `list_agents`, `get_agent`, `create_agent`, `update_agent`, `disable_agent`, `enable_agent`, `delete_agent`, `create_agent_key`, `list_agent_keys`, `revoke_agent_key` |
| Teams | `list_teams`, `get_team`, `create_team`, `update_team`, `archive_team`, `unarchive_team`, `delete_team`, `list_team_members`, `add_team_member`, `remove_team_member` |
| States & labels | `list_states`, `create_state`, `update_state`, `reorder_states`, `delete_state`, `list_labels`, `create_label`, `update_label`, `delete_label` |
| Issues | `create_issue`, `get_issue`, `update_issue`, `move_issue`, `archive_issue`, `delete_issue`, `list_team_issues`, `filter_issues`, `my_issues`, `board`, `list_sub_issues`, `search_issues`, `issue_activity` |
| Comments | `list_comments`, `add_comment`, `edit_comment`, `delete_comment` |
| Projects & cycles | `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`, `project_issues`, `list_cycles`, `get_cycle`, `create_cycle`, `update_cycle`, `cycle_issues` |
| Saved views | `list_views`, `get_view`, `create_view`, `update_view`, `delete_view` |
| Admin (Business) | `list_roles`, `role_assignments`, `create_role`, `update_role`, `delete_role`, `assign_role`, `audit_log` |

Not available to agents: billing, inviting or removing people (Clerk), and Velo's built-in AI assistant.

## Permissions

An agent has exactly the permissions of its role, the same as a person:
- **Members** can create and edit issues, projects, cycles and views.
- **Deleting issues** and **managing teams and labels** need `issues.delete`, `teams.manage` and `labels.manage`. Admins have them, or you can grant them with a custom role (Business plan) via `assign_role`.
- **Private teams** are visible only to their members, agents included.

## Keys: rotation and revocation

- Make one key per place an agent runs, with a clear label. `list_agent_keys` shows when each was last used.
- **Rotate:** create a new key, update the client config, then `revoke_agent_key` the old one by its prefix.
- **Revocation takes effect on the next request.** So does disabling an agent (`disable_agent`), which blocks all of its keys at once.
- Each key is limited to 120 requests a minute.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401` "Missing API key" | No `Authorization: Bearer velo_…` header |
| `401` "Invalid, revoked or disabled API key" | Wrong key, revoked key, or the agent is disabled or deleted |
| `429` with `Retry-After` | Over 120 requests a minute on this key |
| `503` "Agent access is not set up" | Run step 1 on this deployment |
| Tool result `FORBIDDEN: …` | The agent's role doesn't allow it (see Permissions) |
| Tool result `NOT_FOUND: …` | Wrong reference, or something the agent can't see (private team, other workspace) |
| Tool result `INVALID_INPUT: …` | A value failed validation; the message names the field |
| `404` from the server | The URL uses `.convex.cloud` instead of `.convex.site`, or the path isn't `/mcp` |
