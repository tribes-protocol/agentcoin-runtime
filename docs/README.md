# Agentcoin SDK Documentation

Agentcoin SDK is a high-level framework built on top of Eliza OS for creating autonomous AI agents. It provides a simple yet powerful interface for building, customizing, and deploying AI agents with advanced capabilities.

## Quick Start

```typescript
import { AgentcoinSDK } from 'agentcoin-sdk'

// Initialize the SDK
const sdk = await AgentcoinSDK.start()

// Listen for incoming messages
sdk.on('message', async (event) => {
  console.log('New message:', event.text)
  return true // continue processing
})

// Register custom actions
sdk.register('action', {
  name: 'greet',
  execute: async (context) => {
    return { text: 'Hello!' }
  }
})
```

## Overview

Agentcoin SDK is designed to simplify the creation of autonomous AI agents by providing:

- Event-driven architecture for message processing
- Built-in support for LLM interactions
- Extensible plugin system
- Integrated wallet and configuration management
- Robust action handling system

## Core Concepts

### Events

The SDK uses an event system for processing messages and actions:

1. **message** - Triggered when a new message is received
2. **prellm** - Before LLM processing
3. **postllm** - After LLM processing
4. **preaction** - Before action execution
5. **postaction** - After action execution

### Components

#### Providers

Providers are modules that supply specific capabilities to your agent:

```typescript
const customProvider: Provider = {
  name: 'custom',
  provide: async (context) => {
    // Add capabilities
    return context
  }
}

sdk.register('provider', customProvider)
```

#### Actions

Actions define specific tasks your agent can perform:

```typescript
const sendMessageAction: Action = {
  name: 'send_message',
  execute: async (context) => {
    // Perform action
    return { text: 'Message sent!' }
  }
}

sdk.register('action', sendMessageAction)
```

#### Services

Services provide ongoing functionality for your agent:

```typescript
const monitoringService: Service = {
  name: 'monitoring',
  start: async () => {
    // Start service
  },
  stop: async () => {
    // Stop service
  }
}

sdk.register('service', monitoringService)
```

## API Reference

### AgentcoinSDK

#### Methods

- `static start()`: Initialize and start the SDK
- `register(kind, handler)`: Register a new provider, action, or service
- `on(event, handler)`: Subscribe to SDK events
- `off(event, handler)`: Unsubscribe from SDK events

#### Events

```typescript
// Message event
sdk.on('message', async (event: NewMessageEvent) => {
  // Handle new message
  return true // continue processing
})

// Pre-LLM processing
sdk.on('prellm', async (context: Context) => {
  // Modify context before LLM
  return true // continue processing
})

// Post-LLM processing
sdk.on('postllm', async (context: Context) => {
  // Handle LLM response
  return true // continue processing
})

// Pre-action execution
sdk.on('preaction', async (context: Context) => {
  // Prepare for action
  return true // continue processing
})

// Post-action execution
sdk.on('postaction', async (context: Context) => {
  // Handle action results
  return true // continue processing
})
```

## Advanced Usage

### Custom Event Chain

```typescript
const sdk = await AgentcoinSDK.start()

// Pre-process messages
sdk.on('message', async (event) => {
  if (event.text.includes('sensitive')) {
    return false // stop processing
  }
  return true
})

// Modify context before LLM
sdk.on('prellm', async (context) => {
  context.state.customData = { processed: true }
  return true
})

// Handle LLM response
sdk.on('postllm', async (context) => {
  if (!context.content.text) {
    return false // stop if no response
  }
  return true
})
```

### Creating Custom Services

```typescript
class AnalyticsService implements Service {
  name = 'analytics'

  async start() {
    // Initialize analytics
  }

  async stop() {
    // Cleanup
  }

  async track(event: string, data: any) {
    // Track events
  }
}

sdk.register('service', new AnalyticsService())
```

## Best Practices

1. **Event Chain Management**

   - Always return boolean values from event handlers
   - Use early returns to prevent unnecessary processing
   - Keep handlers focused and simple

2. **Error Handling**

   - Implement proper error handling in all handlers
   - Use try-catch blocks for async operations
   - Log errors appropriately

3. **Resource Management**
   - Clean up resources in service stop methods
   - Implement proper shutdown handlers
   - Monitor memory usage in long-running operations

## Contributing

We welcome contributions!
