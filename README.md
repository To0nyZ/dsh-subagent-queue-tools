# dsh-subagent-queue-tools

Host tools for DeepSeek Harness that allow managing subagent message queues:

- `steer_subagent` – Send a high-priority message to a subagent, inserted at the front of its queue (ahead of pending followups).
- `clear_subagent_queue` – Delete all unclaimed queued messages from a subagent’s inbox without affecting the currently running turn.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/To0nyZ/dsh-subagent-queue-tools.git
   cd dsh-subagent-queue-tools
   ```

2. Install dependencies (if any) – currently none.

3. Add the plugin to your DeepSeek Harness profile:
   ```bash
   dsh plugin --profile web add ./dsh-subagent-queue-tools
   ```
   Or copy the entire folder into `~/.dsh/profiles/web/node_modules/` and restart the harness.

## Usage

Once the plugin is loaded, two new tools become available to models and users.

### `steer_subagent`

Sends a `steer` message to a background subagent. The message is placed at the front of the queue and will be processed as soon as the current turn finishes.

**Parameters:**
- `subagent_id` (string, required) – The durable session id of the target subagent.
- `message` (string, required) – The content to deliver.

**Example:**
```json
{
  "subagent_id": "child-abc123",
  "message": "Priority: please stop current work and handle this urgent update."
}
```

**Returns:**
```json
{
  "success": true,
  "message": "Steer message sent to subagent child-abc123."
}
```

### `clear_subagent_queue`

Deletes all pending messages (followups) that are still in the subagent’s inbox and have not yet been claimed for processing. The currently running turn (if any) continues unaffected.

**Parameters:**
- `subagent_id` (string, required) – The durable session id of the target subagent.

**Example:**
```json
{
  "subagent_id": "child-abc123"
}
```

**Returns:**
```json
{
  "success": true,
  "deleted": 5,
  "message": "Deleted 5 queued messages from subagent child-abc123."
}
```

## Permissions

Both tools require the caller to be the **direct parent** of the target subagent. This matches the permission model of the built-in `send_message` tool. If you need to allow deeper ancestors, modify the permission check in `lib/index.js` accordingly.

## Development

- The plugin is written as an ES module.
- It depends on `@deepseek-ai/cordis`, `@deepseek-ai/dsh-subagent`, and `@deepseek-ai/dsh-agent` (peer dependencies).

To test locally:
```bash
# symlink into a harness profile
dsh plugin --profile web link /path/to/dsh-subagent-queue-tools
```

## License

MIT