# AgentCoin Runtime SDK Documentation

The AgentCoin Runtime SDK provides a powerful interface for creating and managing AI agents powered by ElizaOS. This documentation covers the core concepts, setup, and usage of the SDK.

## Table of Contents

- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [Agent Lifecycle](#agent-lifecycle)
- [Event System](#event-system)
- [Registration System](#registration-system)
- [Examples](#examples)

## Getting Started

To create a new agent using the SDK, you'll need to instantiate the `Agent` class and start it:

```typescript
import { Agent } from '@/agent'

const agent = new Agent()
await agent.start()
```

## Core Concepts

The SDK is built on top of ElizaOS and provides several core abstractions:

### Agent

The main class that orchestrates all interactions. It manages the lifecycle of your agent, handles events, and provides registration capabilities for various components.

### Runtime

The underlying ElizaOS runtime that powers the agent. It's automatically initialized when you start the agent and provides access to:

- Character configuration
- Database
- Cache management
- Model providers
- Services
- Actions (Tools)

## Agent Lifecycle

1. **Initialization**: When you create a new Agent instance
2. **Starting**: Call `agent.start()` to initialize the runtime
3. **Registration**: Register services, providers, and tools
4. **Event Handling**: Set up event handlers for LLM and tool interactions
5. **Shutdown**: Graceful shutdown on SIGINT/SIGTERM

## Event System

The SDK provides a comprehensive event system for monitoring and controlling agent behavior. You can subscribe to the following events:

### LLM Events

#### Pre-LLM (`llm:pre`)

Triggered before the LLM processes a request.

```typescript
agent.on('llm:pre', async (context) => {
  // Handle pre-LLM processing
  return true // Return false to cancel the LLM call
})
```

#### Post-LLM (`llm:post`)

Triggered after the LLM has processed a request.

```typescript
agent.on('llm:post', async (context) => {
  // Handle post-LLM processing
  return true // Return false to prevent further processing
})
```

### Tool Events

#### Pre-Tool (`tool:pre`)

Triggered before a tool/action is executed.

```typescript
agent.on('tool:pre', async (context) => {
  // Handle pre-tool execution
  return true // Return false to cancel the tool execution
})
```

#### Post-Tool (`tool:post`)

Triggered after a tool/action has been executed.

```typescript
agent.on('tool:post', async (context) => {
  // Handle post-tool execution
  return true // Return false to prevent further processing
})
```

## Registration System

The SDK allows registration of three types of components:

### 1. Services

Services provide core functionality to your agent. They are long-lived and can maintain state.

```typescript
agent.register('service', new CustomService())
```

### 2. Providers

Providers supply specific capabilities or integrations to your agent.

```typescript
agent.register('provider', new CustomProvider())
```

### 3. Tools (Actions)

Tools are discrete operations that your agent can perform.

```typescript
agent.register('tool', new CustomAction())
```

## Examples

### Basic Agent Setup

```typescript
import { Agent } from '@/agent'
import { CustomAction } from './actions'

async function main() {
  const agent = new Agent()

  // Register event handlers
  agent.on('llm:pre', async (context) => {
    console.log('Processing request:', context)
    return true
  })

  // Register tools
  agent.register('tool', new CustomAction())

  // Start the agent
  await agent.start()
}
```

### Custom Tool Registration

```typescript
import { Action } from '@elizaos/core'

const customTool: Action = {
  name: 'custom-tool',
  description: 'A custom tool for specific tasks',
  execute: async (context) => {
    // Tool implementation
  }
}

agent.register('tool', customTool)
```

## Best Practices

1. **Event Handlers**: Always return `true` unless you specifically want to cancel the operation
2. **Error Handling**: Implement proper error handling in your event handlers and tools
3. **Shutdown**: Let the agent handle shutdown gracefully through the built-in signal handlers
4. **State Management**: Use services for maintaining state across operations
5. **Configuration**: Use the character file for agent-specific configuration

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions for all components. Use the provided interfaces for type safety:

```typescript
import { IAyaAgent } from '@/iagent'
import { ContextHandler } from '@/common/types'
import { Action, Provider, Service } from '@elizaos/core'
```
