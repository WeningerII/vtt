# @vtt/ai

AI integration package for the Virtual Tabletop (VTT) platform.

## Overview

This package provides AI-powered features for enhancing gameplay, including:
- NPC dialogue generation
- Quest and story generation
- Combat AI for NPCs
- Rules clarification and assistance

## Installation

```bash
npm install @vtt/ai
```

## Usage

```typescript
import { AIProvider } from '@vtt/ai';

const ai = new AIProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY
});

// Generate NPC dialogue
const dialogue = await ai.generateDialogue({
  npcName: 'Tavern Keeper',
  context: 'Player asks about rumors'
});
```

## API

### AIProvider

Main class for AI interactions.

#### Methods

- `generateDialogue(options)` - Generate NPC dialogue
- `generateQuest(options)` - Create quest content
- `suggestAction(context)` - Suggest combat actions for NPCs
- `clarifyRule(question)` - Answer rules questions

## Configuration

Configure providers in your environment:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-key-here
```

## License

MIT
