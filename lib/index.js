import { SessionId } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

/**
 * Host plugin that registers:
 *   - steer_subagent(subagent_id, message)
 *   - clear_subagent_queue(subagent_id)
 */
export function apply(ctx) {
  // 工具1: 发送 steer 消息
  ctx.tool({
    name: 'steer_subagent',
    description: 'Send a message to a background subagent with steer priority. The message is placed at the front of the queue and will be processed after the current turn finishes, ahead of any pending followup messages.',
    parameters: {
      type: 'object',
      properties: {
        subagent_id: {
          type: 'string',
          description: 'The durable subagent session id.'
        },
        message: {
          type: 'string',
          description: 'The message content to deliver as a steer.'
        }
      },
      required: ['subagent_id', 'message']
    },
    async handler(args, exec) {
      const caller = exec.agent;
      if (!caller) {
        throw new Error('steer_subagent requires a calling agent (exec.agent was undefined)');
      }

      const childId = SessionId(args.subagent_id);
      const targetAgent = ctx.agents.get(childId);
      if (!targetAgent) {
        throw new Error(`Subagent "${args.subagent_id}" is not live or does not exist.`);
      }

      // 权限验证：调用者必须是目标子智能体的直接父级或祖先
      // 使用 ctx.subagents 的授权逻辑（类似 interrupt_agent）
      const subagents = ctx.get('subagents');
      if (!subagents) {
        throw new Error('Subagent service unavailable.');
      }

      // 手动检查父级关系
      const parentSessionId = targetAgent.session.header.parentSession;
      if (parentSessionId !== caller.id) {
        throw new Error(`Only the direct parent (${parentSessionId}) can steer subagent "${args.subagent_id}".`);
      }

      // 创建用户消息
      const message = createUserMessage({
        content: [{ type: 'text', text: args.message }],
        source: {
          kind: 'user',
          form: 'steer',
          senderSessionId: caller.id
        }
      });

      // 调用 steer 方法
      targetAgent.steer(message);

      return {
        success: true,
        message: `Steer message sent to subagent ${args.subagent_id}.`
      };
    }
  });

  // 工具2: 清除排队消息（删除所有未认领的 followup）
  ctx.tool({
    name: 'clear_subagent_queue',
    description: 'Delete all pending queued messages (followup items) from a subagent\'s inbox, without stopping the current turn. Only unclaimed messages are removed; the currently running turn is unaffected.',
    parameters: {
      type: 'object',
      properties: {
        subagent_id: {
          type: 'string',
          description: 'The durable subagent session id.'
        }
      },
      required: ['subagent_id']
    },
    async handler(args, exec) {
      const caller = exec.agent;
      if (!caller) {
        throw new Error('clear_subagent_queue requires a calling agent (exec.agent was undefined)');
      }

      const childId = SessionId(args.subagent_id);
      const targetAgent = ctx.agents.get(childId);
      if (!targetAgent) {
        throw new Error(`Subagent "${args.subagent_id}" is not live or does not exist.`);
      }

      // 权限验证：只允许直接父级
      const parentSessionId = targetAgent.session.header.parentSession;
      if (parentSessionId !== caller.id) {
        throw new Error(`Only the direct parent (${parentSessionId}) can clear the queue of subagent "${args.subagent_id}".`);
      }

      // 获取 inbox 对象
      const inbox = targetAgent.inbox;
      if (!inbox) {
        throw new Error(`Subagent "${args.subagent_id}" has no inbox.`);
      }

      // 删除所有未认领的消息（即 messages 数组中所有条目）
      const messages = inbox.messages;
      const count = messages.length;
      if (count === 0) {
        return {
          success: true,
          deleted: 0,
          message: `No queued messages to delete for subagent ${args.subagent_id}.`
        };
      }

      // 删除全部，并丢弃它们
      inbox.mutate(messages, 0, count, [], true);

      return {
        success: true,
        deleted: count,
        message: `Deleted ${count} queued messages from subagent ${args.subagent_id}.`
      };
    }
  });
}