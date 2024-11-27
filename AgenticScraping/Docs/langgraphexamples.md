# File Overview
This file contains a series of examples of how to use the LangGraph class to create agentic AI workflwos using a graph model to model the workflow.

# LangGraph Overview & Simple Example
Overview¶
LangGraph.js is a library for building stateful, multi-actor applications with LLMs, used to create agent and multi-agent workflows. Compared to other LLM frameworks, it offers these core benefits: cycles, controllability, and persistence. LangGraph allows you to define flows that involve cycles, essential for most agentic architectures, differentiating it from DAG-based solutions. As a very low-level framework, it provides fine-grained control over both the flow and state of your application, crucial for creating reliable agents. Additionally, LangGraph includes built-in persistence, enabling advanced human-in-the-loop and memory features.

LangGraph is inspired by Pregel and Apache Beam. The public interface draws inspiration from NetworkX. LangGraph is built by LangChain Inc, the creators of LangChain, but can be used without LangChain.

Key Features¶
Cycles and Branching: Implement loops and conditionals in your apps.
Persistence: Automatically save state after each step in the graph. Pause and resume the graph execution at any point to support error recovery, human-in-the-loop workflows, time travel and more.
Human-in-the-Loop: Interrupt graph execution to approve or edit next action planned by the agent.
Streaming Support: Stream outputs as they are produced by each node (including token streaming).
Integration with LangChain: LangGraph integrates seamlessly with LangChain.js and LangSmith (but does not require them).
Installation¶

npm install @langchain/langgraph @langchain/core
Example¶
One of the central concepts of LangGraph is state. Each graph execution creates a state that is passed between nodes in the graph as they execute, and each node updates this internal state with its return value after it executes. The way that the graph updates its internal state is defined by either the type of graph chosen or a custom function.

Let's take a look at an example of an agent that can use a search tool.

First install the required dependencies:

```
npm install @langchain/anthropic
Then set the required environment variables:
```

```
export ANTHROPIC_API_KEY=sk-...
```

Optionally, set up LangSmith for best-in-class observability:


```
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=ls__...
```

Now let's define our agent:

```
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph } from "@langchain/langgraph";
import { MemorySaver, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Define the graph state
// See here for more info: https://langchain-ai.github.io/langgraphjs/how-tos/define-state/
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  })
})

// Define the tools for the agent to use
const weatherTool = tool(async ({ query }) => {
  // This is a placeholder for the actual implementation
  if (query.toLowerCase().includes("sf") || query.toLowerCase().includes("san francisco")) {
    return "It's 60 degrees and foggy."
  }
  return "It's 90 degrees and sunny."
}, {
  name: "weather",
  description:
    "Call to get the current weather for a location.",
  schema: z.object({
    query: z.string().describe("The query to use in your search."),
  }),
});

const tools = [weatherTool];
const toolNode = new ToolNode(tools);

const model = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0,
}).bindTools(tools);

// Define the function that determines whether to continue or not
// We can extract the state typing via `StateAnnotation.State`
function shouldContinue(state: typeof StateAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  // Otherwise, we stop (reply to the user)
  return "__end__";
}

// Define the function that calls the model
async function callModel(state: typeof StateAnnotation.State) {
  const messages = state.messages;
  const response = await model.invoke(messages);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define a new graph
const workflow = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// Initialize memory to persist state between graph runs
const checkpointer = new MemorySaver();

// Finally, we compile it!
// This compiles it into a LangChain Runnable.
// Note that we're (optionally) passing the memory when compiling the graph
const app = workflow.compile({ checkpointer });

// Use the Runnable
const finalState = await app.invoke(
  { messages: [new HumanMessage("what is the weather in sf")] },
  { configurable: { thread_id: "42" } }
);

console.log(finalState.messages[finalState.messages.length - 1].content);
```

This will output:

```
Based on the information I received, the current weather in San Francisco is:

Temperature: 60 degrees Fahrenheit
Conditions: Foggy

San Francisco is known for its foggy weather, especially during certain times of the year. The moderate temperature of 60°F (about 15.5°C) is quite typical for the city, which generally has mild weather year-round due to its coastal location.

Is there anything else you'd like to know about the weather in San Francisco or any other location?
```

Now when we pass the same "thread_id", the conversation context is retained via the saved state (i.e. stored list of messages):

```
const nextState = await app.invoke(
  { messages: [new HumanMessage("what about ny")] },
  { configurable: { thread_id: "42" } }
);
console.log(nextState.messages[nextState.messages.length - 1].content);
```
```
Based on the information I received, the current weather in New York is:

Temperature: 90 degrees Fahrenheit (approximately 32.2 degrees Celsius)
Conditions: Sunny

New York is experiencing quite warm weather today. A temperature of 90°F is considered hot for most people, and it's significantly warmer than the San Francisco weather we just checked. The sunny conditions suggest it's a clear day without cloud cover, which can make it feel even warmer.

On a day like this in New York, it would be advisable for people to stay hydrated, seek shade when possible, and use sun protection if spending time outdoors.

Is there anything else you'd like to know about the weather in New York or any other location?
```

Step-by-step Breakdown
1. Initialize the model and tools.
We use ChatAnthropic as our LLM. NOTE: We need make sure the model knows that it has these tools available to call. We can do this by converting the LangChain tools into the format for Anthropic tool calling using the .bindTools() method.
We define the tools we want to use -- a weather tool in our case. See the documentation here on how to create your own tools.
2. Initialize graph with state.
We initialize the graph (StateGraph) by passing the state interface (AgentState).
The StateAnnotation object defines how updates from each node should be merged into the graph's state.
3. Define graph nodes.
There are two main nodes we need:

The agent node: responsible for deciding what (if any) actions to take.
The tools node that invokes tools: if the agent decides to take an action, this node will then execute that action.
4. Define entry point and graph edges.
First, we need to set the entry point for graph execution - the agent node.

Then we define one normal and one conditional edge. A conditional edge means that the destination depends on the contents of the graph's state (AgentState). In our case, the destination is not known until the agent (LLM) decides.

Conditional edge: after the agent is called, we should either:
a. Run tools if the agent said to take an action, OR
b. Finish (respond to the user) if the agent did not ask to run tools
Normal edge: after the tools are invoked, the graph should always return to the agent to decide what to do next
5. Compile the graph.
When we compile the graph, we turn it into a LangChain Runnable, which automatically enables calling .invoke(), .stream() and .batch() with your inputs.
We can also optionally pass a checkpointer object for persisting state between graph runs, enabling memory, human-in-the-loop workflows, time travel and more. In our case we use MemorySaver - a simple in-memory checkpointer.
6. Execute the graph.
LangGraph adds the input message to the internal state, then passes the state to the entrypoint node, "agent".
The "agent" node executes, invoking the chat model.
The chat model returns an AIMessage. LangGraph adds this to the state.
The graph cycles through the following steps until there are no more tool_calls on the AIMessage:

If AIMessage has tool_calls, the "tools" node executes.
The "agent" node executes again and returns an AIMessage.
Execution progresses to the special __end__ value and outputs the final state. As a result, we get a list of all our chat messages as output.


# LangGraph Glossary
At its core, LangGraph models agent workflows as graphs. You define the behavior of your agents using three key components:

1.  [`State`](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state): A shared data structure that represents the current snapshot of your application. It is represented by an [`Annotation`](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph.Annotation.html) object.
    
2.  [`Nodes`](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#nodes): JavaScript/TypeScript functions that encode the logic of your agents. They receive the current `State` as input, perform some computation or side-effect, and return an updated `State`.
    
3.  [`Edges`](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#edges): JavaScript/TypeScript functions that determine which `Node` to execute next based on the current `State`. They can be conditional branches or fixed transitions.
    

By composing `Nodes` and `Edges`, you can create complex, looping workflows that evolve the `State` over time. The real power, though, comes from how LangGraph manages that `State`. To emphasize: `Nodes` and `Edges` are nothing more than JavaScript/TypeScript functions - they can contain an LLM or just good ol' JavaScript/TypeScript code.

In short: _nodes do the work. edges tell what to do next_.

LangGraph's underlying graph algorithm uses [message passing](https://en.wikipedia.org/wiki/Message_passing) to define a general program. When a Node completes its operation, it sends messages along one or more edges to other node(s). These recipient nodes then execute their functions, pass the resulting messages to the next set of nodes, and the process continues. Inspired by Google's [Pregel](https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/) system, the program proceeds in discrete "super-steps."

A super-step can be considered a single iteration over the graph nodes. Nodes that run in parallel are part of the same super-step, while nodes that run sequentially belong to separate super-steps. At the start of graph execution, all nodes begin in an `inactive` state. A node becomes `active` when it receives a new message (state) on any of its incoming edges (or "channels"). The active node then runs its function and responds with updates. At the end of each super-step, nodes with no incoming messages vote to `halt` by marking themselves as `inactive`. The graph execution terminates when all nodes are `inactive` and no messages are in transit.

### StateGraph[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#stategraph "Permanent link")

The `StateGraph` class is the main graph class to use. This is parameterized by a user defined `State` object. (defined using the `Annotation` object and passed as the first argument)

### MessageGraph (legacy)[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#messagegraph "Permanent link")

The `MessageGraph` class is a special type of graph. The `State` of a `MessageGraph` is ONLY an array of messages. This class is rarely used except for chatbots, as most applications require the `State` to be more complex than an array of messages.

### Compiling your graph[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#compiling-your-graph "Permanent link")

To build your graph, you first define the [state](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state), you then add [nodes](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#nodes) and [edges](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#edges), and then you compile it. What exactly is compiling your graph and why is it needed?

Compiling is a pretty simple step. It provides a few basic checks on the structure of your graph (no orphaned nodes, etc). It is also where you can specify runtime args like checkpointers and [breakpoints](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#breakpoints). You compile your graph by just calling the `.compile` method:

```
[](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#__codelineno-0-1)constgraph=graphBuilder.compile(...);
```

You **MUST** compile your graph before you can use it.

State[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state "Permanent link")
-----------------------------------------------------------------------------------------------

The first thing you do when you define a graph is define the `State` of the graph. The `State` includes information on the structure of the graph, as well as [`reducer` functions](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#reducers) which specify how to apply updates to the state. The schema of the `State` will be the input schema to all `Nodes` and `Edges` in the graph, and should be defined using an [`Annotation`](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph.Annotation.html) object. All `Nodes` will emit updates to the `State` which are then applied using the specified `reducer` function.

### Annotation[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#annotation "Permanent link")

The way to specify the schema of a graph is by defining a root [`Annotation`](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph.Annotation.html) object, where each key is an item in the state.

#### Multiple schemas[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#multiple-schemas "Permanent link")

Typically, all graph nodes communicate with a single state annotation. This means that they will read and write to the same state channels. But, there are cases where we want more control over this:

*   Internal nodes can pass information that is not required in the graph's input / output.
*   We may also want to use different input / output schemas for the graph. The output might, for example, only contain a single relevant output key.

It is possible to have nodes write to private state channels inside the graph for internal node communication. We can simply define a private annotation, `PrivateState`. See [this notebook](https://langchain-ai.github.io/langgraphjs/how-tos/pass_private_state/) for more detail.

It is also possible to define explicit input and output schemas for a graph. In these cases, we define an "internal" schema that contains _all_ keys relevant to graph operations. But, we also define `input` and `output` schemas that are sub-sets of the "internal" schema to constrain the input and output of the graph. See [this guide](https://langchain-ai.github.io/langgraphjs/how-tos/input_output_schema/) for more detail.

Let's look at an example:

```
import { Annotation, StateGraph } from "@langchain/langgraph";

const InputStateAnnotation = Annotation.Root({
  user_input: Annotation<string>,
});

const OutputStateAnnotation = Annotation.Root({
  graph_output: Annotation<string>,
});

const OverallStateAnnotation = Annotation.Root({
  foo: Annotation<string>,
  bar: Annotation<string>,
  user_input: Annotation<string>,
  graph_output: Annotation<string>,
});

const node1 = async (state: typeof InputStateAnnotation.State) => {
  // Write to OverallStateAnnotation
  return { foo: state.user_input + " name" };
};

const node2 = async (state: typeof OverallStateAnnotation.State) => {
  // Read from OverallStateAnnotation, write to OverallStateAnnotation
  return { bar: state.foo + " is" };
};

const node3 = async (state: typeof OverallStateAnnotation.State) => {
  // Read from OverallStateAnnotation, write to OutputStateAnnotation
  return { graph_output: state.bar + " Lance" };
};

const graph = new StateGraph({
  input: InputStateAnnotation,
  output: OutputStateAnnotation,
  stateSchema: OverallStateAnnotation,
})
  .addNode("node1", node1)
  .addNode("node2", node2)
  .addNode("node3", node3)
  .addEdge("__start__", "node1")
  .addEdge("node1", "node2")
  .addEdge("node2", "node3")
  .compile();

await graph.invoke({ user_input: "My" });
```

```
{ graph_output: "My name is Lance" }
```
Note that we pass `state: typeof InputStateAnnotation.State` as the input schema to `node1`. But, we write out to `foo`, a channel in `OverallStateAnnotation`. How can we write out to a state channel that is not included in the input schema? This is because a node _can write to any state channel in the graph state._ The graph state is the union of of the state channels defined at initialization, which includes `OverallStateAnnotation` and the filters `InputStateAnnotation` and `OutputStateAnnotation`.

### Reducers[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#reducers "Permanent link")

Reducers are key to understanding how updates from nodes are applied to the `State`. Each key in the `State` has its own independent reducer function. If no reducer function is explicitly specified then it is assumed that all updates to that key should override it. Let's take a look at a few examples to understand them better.

**Example A:**
```
import { StateGraph, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  foo: Annotation<number>,
  bar: Annotation<string[]>,
});

const graphBuilder = new StateGraph(State);
```


In this example, no reducer functions are specified for any key. Let's assume the input to the graph is `{ foo: 1, bar: ["hi"] }`. Let's then assume the first `Node` returns `{ foo: 2 }`. This is treated as an update to the state. Notice that the `Node` does not need to return the whole `State` schema - just an update. After applying this update, the `State` would then be `{ foo: 2, bar: ["hi"] }`. If the second node returns `{ bar: ["bye"] }` then the `State` would then be `{ foo: 2, bar: ["bye"] }`

**Example B:**

```
import { StateGraph, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  foo: Annotation<number>,
  bar: Annotation<string[]>({
    reducer: (state: string[], update: string[]) => state.concat(update),
    default: () => [],
  }),
});

const graphBuilder = new StateGraph(State);
```
In this example, we've updated our `bar` field to be an object containing a `reducer` function. This function will always accept two positional arguments: `state` and `update`, with `state` representing the current state value, and `update` representing the update returned from a `Node`. Note that the first key remains unchanged. Let's assume the input to the graph is `{ foo: 1, bar: ["hi"] }`. Let's then assume the first `Node` returns `{ foo: 2 }`. This is treated as an update to the state. Notice that the `Node` does not need to return the whole `State` schema - just an update. After applying this update, the `State` would then be `{ foo: 2, bar: ["hi"] }`. If the second node returns`{ bar: ["bye"] }` then the `State` would then be `{ foo: 2, bar: ["hi", "bye"] }`. Notice here that the `bar` key is updated by concatenating the two arrays together.

### Working with Messages in Graph State[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#working-with-messages-in-graph-state "Permanent link")

#### Why use messages?[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#why-use-messages "Permanent link")

Most modern LLM providers have a chat model interface that accepts a list of messages as input. LangChain's [`ChatModel`](https://js.langchain.com/docs/concepts/#chat-models) in particular accepts a list of `Message` objects as inputs. These messages come in a variety of forms such as `HumanMessage` (user input) or `AIMessage` (LLM response). To read more about what message objects are, please refer to [this](https://js.langchain.com/docs/concepts/#message-types) conceptual guide.

#### Using Messages in your Graph[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#using-messages-in-your-graph "Permanent link")

In many cases, it is helpful to store prior conversation history as a list of messages in your graph state. To do so, we can add a key (channel) to the graph state that stores a list of `Message` objects and annotate it with a reducer function (see `messages` key in the example below). The reducer function is vital to telling the graph how to update the list of `Message` objects in the state with each state update (for example, when a node sends an update). If you don't specify a reducer, every state update will overwrite the list of messages with the most recently provided value.

However, you might also want to manually update messages in your graph state (e.g. human-in-the-loop). If you were to use something like `(a, b) => a.concat(b)` as a reducer, the manual state updates you send to the graph would be appended to the existing list of messages, instead of updating existing messages. To avoid that, you need a reducer that can keep track of message IDs and overwrite existing messages, if updated. To achieve this, you can use the prebuilt `messagesStateReducer` function. For brand new messages, it will simply append to existing list, but it will also handle the updates for existing messages correctly.

#### Serialization[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#serialization "Permanent link")

In addition to keeping track of message IDs, the `messagesStateReducer` function will also try to deserialize messages into LangChain `Message` objects whenever a state update is received on the `messages` channel. This allows sending graph inputs / state updates in the following format:

```
// this is supported
{
  messages: [new HumanMessage({ content: "message" })];
}

// and this is also supported
{
  messages: [{ role: "user", content: "message" }];
}
```

Below is an example of a graph state annotation that uses `messagesStateReducer` as it's reducer function.

```
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, type Messages } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
  }),
});
```

#### MessagesAnnotation[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#messagesannotation "Permanent link")

Since having a list of messages in your state is so common, there exists a prebuilt annotation called `MessagesAnnotation` which makes it easy to use messages as graph state. `MessagesAnnotation` is defined with a single `messages` key which is a list of `BaseMessage` objects and uses the `messagesStateReducer` reducer.

```
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";

const graph = new StateGraph(MessagesAnnotation)
  .addNode(...)
  ...
```
Is equivalent to initializing your state manually like this:

```
import { BaseMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, messagesStateReducer } from "@langchain/langgraph";

export const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

const graph = new StateGraph(StateAnnotation)
  .addNode(...)
  ...
```

The state of a `MessagesAnnotation` has a single key called `messages`. This is an array of `BaseMessage`s, with [`messagesStateReducer`](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph.messagesStateReducer.html) as a reducer. `messagesStateReducer` basically adds messages to the existing list (it also does some nice extra things, like convert from OpenAI message format to the standard LangChain message format, handle updates based on message IDs, etc).

We often see an array of messages being a key component of state, so this prebuilt state is intended to make it easy to use messages. Typically, there is more state to track than just messages, so we see people extend this state and add more fields, like:

```
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

const StateWithDocuments = Annotation.Root({
  ...MessagesAnnotation.spec, // Spread in the messages state
  documents: Annotation<string[]>,
});
```

Nodes[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#nodes "Permanent link")
-----------------------------------------------------------------------------------------------

In LangGraph, nodes are typically JavaScript/TypeScript functions (sync or `async`) where the **first** positional argument is the [state](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state), and (optionally), the **second** positional argument is a "config", containing optional [configurable parameters](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#configuration) (such as a `thread_id`).

Similar to `NetworkX`, you add these nodes to a graph using the [addNode](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html#addNode) method:

```
import { RunnableConfig } from "@langchain/core/runnables";
import { StateGraph, Annotation } from "@langchain/langgraph";

const GraphAnnotation = Annotation.Root({
  input: Annotation<string>,
  results: Annotation<string>,
})

// The state type can be extracted using `typeof <annotation variable name>.State`
const myNode = (state: typeof GraphAnnotation.State, config?: RunnableConfig) => {
  console.log("In node: ", config.configurable?.user_id);
  return {
    results: `Hello, ${state.input}!`
  }
}

// The second argument is optional
const myOtherNode = (state: typeof GraphAnnotation.State) => {
  return state
}

const builder = new StateGraph(GraphAnnotation)
  .addNode("myNode", myNode)
  .addNode("myOtherNode", myOtherNode)
  ...
```

Behind the scenes, functions are converted to [RunnableLambda's](https://v02.api.js.langchain.com/classes/langchain_core_runnables.RunnableLambda.html), which adds batch and streaming support to your function, along with native tracing and debugging.

### `START` Node[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#start-node "Permanent link")

The `START` Node is a special node that represents the node sends user input to the graph. The main purpose for referencing this node is to determine which nodes should be called first.

```
import { START } from "@langchain/langgraph";

graph.addEdge(START, "nodeA");
```

### `END` Node[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#end-node "Permanent link")

The `END` Node is a special node that represents a terminal node. This node is referenced when you want to denote which edges have no actions after they are done.

```
import { END } from "@langchain/langgraph";

graph.addEdge("nodeA", END);
```

Edges[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#edges "Permanent link")
-----------------------------------------------------------------------------------------------

Edges define how the logic is routed and how the graph decides to stop. This is a big part of how your agents work and how different nodes communicate with each other. There are a few key types of edges:

*   Normal Edges: Go directly from one node to the next.
*   Conditional Edges: Call a function to determine which node(s) to go to next.
*   Entry Point: Which node to call first when user input arrives.
*   Conditional Entry Point: Call a function to determine which node(s) to call first when user input arrives.

A node can have MULTIPLE outgoing edges. If a node has multiple out-going edges, **all** of those destination nodes will be executed in parallel as a part of the next superstep.

### Normal Edges[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#normal-edges "Permanent link")

If you **always** want to go from node A to node B, you can use the [addEdge](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html#addEdge) method directly.

```
graph.addEdge("nodeA", "nodeB");
```

### Conditional Edges[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#conditional-edges "Permanent link")

If you want to **optionally** route to 1 or more edges (or optionally terminate), you can use the [addConditionalEdges](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html#addConditionalEdges) method. This method accepts the name of a node and a "routing function" to call after that node is executed:

```
graph.addConditionalEdges("nodeA", routingFunction);
```

Similar to nodes, the `routingFunction` accept the current `state` of the graph and return a value.

By default, the return value `routingFunction` is used as the name of the node (or an array of nodes) to send the state to next. All those nodes will be run in parallel as a part of the next superstep.

You can optionally provide an object that maps the `routingFunction`'s output to the name of the next node.

```
graph.addConditionalEdges("nodeA", routingFunction, {
  true: "nodeB",
  false: "nodeC",
});
```

### Entry Point[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#entry-point "Permanent link")

The entry point is the first node(s) that are run when the graph starts. You can use the [`addEdge`](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html#addEdge) method from the virtual [`START`](https://langchain-ai.github.io/langgraphjs/reference/variables/langgraph.START.html) node to the first node to execute to specify where to enter the graph.

```
import { START } from "@langchain/langgraph";

graph.addEdge(START, "nodeA");
```

### Conditional Entry Point[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#conditional-entry-point "Permanent link")

A conditional entry point lets you start at different nodes depending on custom logic. You can use [`addConditionalEdges`](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html#addConditionalEdges) from the virtual [`START`](https://langchain-ai.github.io/langgraphjs/reference/variables/langgraph.START.html) node to accomplish this.

```
import { START } from "@langchain/langgraph";

graph.addConditionalEdges(START, routingFunction);
```

You can optionally provide an object that maps the `routingFunction`'s output to the name of the next node.

```
graph.addConditionalEdges(START, routingFunction, {
  true: "nodeB",
  false: "nodeC",
});
```

`Send`[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#send "Permanent link")
-----------------------------------------------------------------------------------------------

By default, `Nodes` and `Edges` are defined ahead of time and operate on the same shared state. However, there can be cases where the exact edges are not known ahead of time and/or you may want different versions of `State` to exist at the same time. A common of example of this is with `map-reduce` design patterns. In this design pattern, a first node may generate an array of objects, and you may want to apply some other node to all those objects. The number of objects may be unknown ahead of time (meaning the number of edges may not be known) and the input `State` to the downstream `Node` should be different (one for each generated object).

To support this design pattern, LangGraph supports returning [`Send`](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.Send.html) objects from conditional edges. `Send` takes two arguments: first is the name of the node, and second is the state to pass to that node.

```
const continueToJokes = (state: { subjects: string[] }) => {
  return state.subjects.map(
    (subject) => new Send("generate_joke", { subject })
  );
};

graph.addConditionalEdges("nodeA", continueToJokes);
```

Persistence[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#persistence "Permanent link")
-----------------------------------------------------------------------------------------------------------

LangGraph provides built-in persistence for your agent's state using [checkpointers](https://langchain-ai.github.io/langgraphjs/reference/classes/checkpoint.BaseCheckpointSaver.html). Checkpointers save snapshots of the graph state at every superstep, allowing resumption at any time. This enables features like human-in-the-loop interactions, memory management, and fault-tolerance. You can even directly manipulate a graph's state after its execution using the appropriate `get` and `update` methods. For more details, see the [conceptual guide](https://langchain-ai.github.io/langgraphjs/concepts/persistence) for more information.

Threads[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#threads "Permanent link")
---------------------------------------------------------------------------------------------------

Threads in LangGraph represent individual sessions or conversations between your graph and a user. When using checkpointing, turns in a single conversation (and even steps within a single graph execution) are organized by a unique thread ID.

Storage[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#storage "Permanent link")
---------------------------------------------------------------------------------------------------

LangGraph provides built-in document storage through the [BaseStore](https://langchain-ai.github.io/langgraphjs/reference/classes/store.BaseStore.html) interface. Unlike checkpointers, which save state by thread ID, stores use custom namespaces for organizing data. This enables cross-thread persistence, allowing agents to maintain long-term memories, learn from past interactions, and accumulate knowledge over time. Common use cases include storing user profiles, building knowledge bases, and managing global preferences across all threads.

Graph Migrations[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#graph-migrations "Permanent link")
---------------------------------------------------------------------------------------------------------------------

LangGraph can easily handle migrations of graph definitions (nodes, edges, and state) even when using a checkpointer to track state.

*   For threads at the end of the graph (i.e. not interrupted) you can change the entire topology of the graph (i.e. all nodes and edges, remove, add, rename, etc)
*   For threads currently interrupted, we support all topology changes other than renaming / removing nodes (as that thread could now be about to enter a node that no longer exists) -- if this is a blocker please reach out and we can prioritize a solution.
*   For modifying state, we have full backwards and forwards compatibility for adding and removing keys
*   State keys that are renamed lose their saved state in existing threads
*   State keys whose types change in incompatible ways could currently cause issues in threads with state from before the change -- if this is a blocker please reach out and we can prioritize a solution.

Configuration[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#configuration "Permanent link")
---------------------------------------------------------------------------------------------------------------

When creating a graph, you can also mark that certain parts of the graph are configurable. This is commonly done to enable easily switching between models or system prompts. This allows you to create a single "cognitive architecture" (the graph) but have multiple different instance of it.

You can then pass this configuration into the graph using the `configurable` config field.

```
const config = { configurable: { llm: "anthropic" } };

await graph.invoke(inputs, config);
```

You can then access and use this configuration inside a node:

```
const nodeA = (state, config) => {
  const llmType = config?.configurable?.llm;
  let llm: BaseChatModel;
  if (llmType) {
    const llm = getLlm(llmType);
  }
  ...
};
```

See [this guide](https://langchain-ai.github.io/langgraphjs/how-tos/configuration/) for a full breakdown on configuration

Breakpoints[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#breakpoints "Permanent link")
-----------------------------------------------------------------------------------------------------------

It can often be useful to set breakpoints before or after certain nodes execute. This can be used to wait for human approval before continuing. These can be set when you ["compile" a graph](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#compiling-your-graph), or thrown dynamically using a special error called a [`NodeInterrupt`](https://langchain-ai.github.io/langgraphjs/how-tos/dynamic_breakpoints/). You can set breakpoints either _before_ a node executes (using `interruptBefore`) or after a node executes (using `interruptAfter`).

You **MUST** use a checkpointer when using breakpoints. This is because your graph needs to be able to resume execution after interrupting.

In order to resume execution, you can just invoke your graph with `null` as the input and the same `thread_id`.

```
const config = { configurable: { thread_id: "foo" } };

// Initial run of graph
await graph.invoke(inputs, config);

// Let's assume it hit a breakpoint somewhere, you can then resume by passing in None
await graph.invoke(null, config);
```

See [this guide](https://langchain-ai.github.io/langgraphjs/how-tos/breakpoints/) for a full walkthrough of how to add breakpoints.

### Dynamic Breakpoints[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#dynamic-breakpoints "Permanent link")

It may be helpful to **dynamically** interrupt the graph from inside a given node based on some condition. In `LangGraph` you can do so by using `NodeInterrupt` -- a special error that can be raised from inside a node.

```
function myNode(
  state: typeof GraphAnnotation.State
): typeof GraphAnnotation.State {
  if (state.input.length > 5) {
    throw new NodeInterrupt(
      `Received input that is longer than 5 characters: ${state.input}`
    );
  }

  return state;
}
```

Subgraphs[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#subgraphs "Permanent link")
-------------------------------------------------------------------------------------------------------

A subgraph is a [graph](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#graphs) that is used as a [node](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#nodes) in another graph. This is nothing more than the age-old concept of encapsulation, applied to LangGraph. Some reasons for using subgraphs are:

*   building [multi-agent systems](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/)
*   when you want to reuse a set of nodes in multiple graphs, which maybe share some state, you can define them once in a subgraph and then use them in multiple parent graphs
*   when you want different teams to work on different parts of the graph independently, you can define each part as a subgraph, and as long as the subgraph interface (the input and output schemas) is respected, the parent graph can be built without knowing any details of the subgraph

There are two ways to add subgraphs to a parent graph:

*   add a node with the compiled subgraph: this is useful when the parent graph and the subgraph share state keys and you don't need to transform state on the way in or out

```
.addNode("subgraph", subgraphBuilder.compile());
```

*   add a node with a function that invokes the subgraph: this is useful when the parent graph and the subgraph have different state schemas and you need to transform state before or after calling the subgraph

```
const subgraph = subgraphBuilder.compile();

const callSubgraph = async (state: typeof StateAnnotation.State) => {
  return subgraph.invoke({ subgraph_key: state.parent_key });
};

builder.addNode("subgraph", callSubgraph);
```

Let's take a look at examples for each.

### As a compiled graph[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#as-a-compiled-graph "Permanent link")

The simplest way to create subgraph nodes is by using a [compiled subgraph](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#compiling-your-graph) directly. When doing so, it is **important** that the parent graph and the subgraph [state schemas](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state) share at least one key which they can use to communicate. If your graph and subgraph do not share any keys, you should use write a function [invoking the subgraph](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#as-a-function) instead.

Note

If you pass extra keys to the subgraph node (i.e., in addition to the shared keys), they will be ignored by the subgraph node. Similarly, if you return extra keys from the subgraph, they will be ignored by the parent graph.

```
import { StateGraph, Annotation } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  foo: Annotation<string>,
});

const SubgraphStateAnnotation = Annotation.Root({
  foo: Annotation<string>, // note that this key is shared with the parent graph state
  bar: Annotation<string>,
});

// Define subgraph
const subgraphNode = async (state: typeof SubgraphStateAnnotation.State) => {
  // note that this subgraph node can communicate with
  // the parent graph via the shared "foo" key
  return { foo: state.foo + "bar" };
};

const subgraph = new StateGraph(SubgraphStateAnnotation)
  .addNode("subgraph", subgraphNode);
  ...
  .compile();

// Define parent graph
const parentGraph = new StateGraph(StateAnnotation)
  .addNode("subgraph", subgraph)
  ...
  .compile();
```

### As a function[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#as-a-function "Permanent link")

You might want to define a subgraph with a completely different schema. In this case, you can create a node function that invokes the subgraph. This function will need to [transform](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph-transform-state/) the input (parent) state to the subgraph state before invoking the subgraph, and transform the results back to the parent state before returning the state update from the node.

```
import { StateGraph, Annotation } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  foo: Annotation<string>,
});

const SubgraphStateAnnotation = Annotation.Root({
  // note that none of these keys are shared with the parent graph state
  bar: Annotation<string>,
  baz: Annotation<string>,
});

// Define subgraph
const subgraphNode = async (state: typeof SubgraphStateAnnotation.State) => {
  return { bar: state.bar + "baz" };
};

const subgraph = new StateGraph(SubgraphStateAnnotation)
  .addNode("subgraph", subgraphNode);
  ...
  .compile();

// Define parent graph
const subgraphWrapperNode = async (state: typeof StateAnnotation.State) => {
  // transform the state to the subgraph state
  const response = await subgraph.invoke({
    bar: state.foo,
  });
  // transform response back to the parent state
  return {
    foo: response.bar,
  };
}

const parentGraph = new StateGraph(StateAnnotation)
  .addNode("subgraph", subgraphWrapperNode)
  ...
  .compile();
```

Visualization[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#visualization "Permanent link")
---------------------------------------------------------------------------------------------------------------

It's often nice to be able to visualize graphs, especially as they get more complex. LangGraph comes with a nice built-in way to render a graph as a Mermaid diagram. You can use the `getGraph()` method like this:

```
const representation = graph.getGraph();
const image = await representation.drawMermaidPng();
const arrayBuffer = await image.arrayBuffer();
const buffer = new Uint8Array(arrayBuffer);
```

You can also check out [LangGraph Studio](https://github.com/langchain-ai/langgraph-studio) for a bespoke IDE that includes powerful visualization and debugging features.

Streaming[¶](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#streaming "Permanent link")
-------------------------------------------------------------------------------------------------------

LangGraph is built with first class support for streaming. There are several different streaming modes that LangGraph supports:

*   [`"values"`](https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/): This streams the full value of the state after each step of the graph.
*   [`"updates`](https://langchain-ai.github.io/langgraphjs/how-tos/stream-updates/): This streams the updates to the state after each step of the graph. If multiple updates are made in the same step (e.g. multiple nodes are run) then those updates are streamed separately.

In addition, you can use the [`streamEvents`](https://api.js.langchain.com/classes/langchain_core_runnables.Runnable.html#streamEvents) method to stream back events that happen _inside_ nodes. This is useful for [streaming tokens of LLM calls](https://langchain-ai.github.io/langgraphjs/how-tos/streaming-tokens-without-langchain/).

LangGraph is built with first class support for streaming, including streaming updates from graph nodes during execution, streaming tokens from LLM calls and more. See this [conceptual guide](https://langchain-ai.github.io/langgraphjs/concepts/streaming/) for more information.


# How to define graph state
How to define graph state
This how to guide will cover different ways to define the state of your graph.

Prerequisites
State conceptual guide - Conceptual guide on defining the state of your graph.
Building graphs - This how-to assumes you have a basic understanding of how to build graphs.
Setup
This guide requires installing the @langchain/langgraph, and @langchain/core packages:

npm install @langchain/langgraph @langchain/core
Getting started
The Annotation function is the recommended way to define your graph state for new StateGraph graphs. The Annotation.Root function is used to create the top-level state object, where each field represents a channel in the graph.

Here's an example of how to define a simple graph state with one channel called messages:

```
import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

const GraphAnnotation = Annotation.Root({
  // Define a 'messages' channel to store an array of BaseMessage objects
  messages: Annotation<BaseMessage[]>({
    // Reducer function: Combines the current state with new messages
    reducer: (currentState, updateValue) => currentState.concat(updateValue),
    // Default function: Initialize the channel with an empty array
    default: () => [],
  })
});
```

Each channel can optionally have reducer and default functions:

The reducer function defines how new values are combined with the existing state.
The default function provides an initial value for the channel.
For more information on reducers, see the reducers conceptual guide

```
const QuestionAnswerAnnotation = Annotation.Root({
  question: Annotation<string>,
  answer: Annotation<string>,
});
```

Above, all we're doing is defining the channels, and then passing the un-instantiated Annotation function as the value. It is important to note we always pass in the TypeScript type of each channel as the first generics argument to Annotation. Doing this ensures our graph state is type safe, and we can get the proper types when defining our nodes. Below shows how you can extract the typings from the Annotation function:

```
type QuestionAnswerAnnotationType = typeof QuestionAnswerAnnotation.State;
```

This is equivalent to the following type:

```
type QuestionAnswerAnnotationType = {
  question: string;
  answer: string;
}
```

Merging states
If you have two graph state annotations, you can merge the two into a single annotation by using the spec value:

```
const MergedAnnotation = Annotation.Root({
  ...QuestionAnswerAnnotation.spec,
  ...GraphAnnotation.spec,
})
```
The type of the merged annotation is the intersection of the two annotations:

```
type MergedAnnotation = {
  messages: BaseMessage[];
  question: string;
  answer: string;
}
```
Finally, instantiating your graph using the annotations is as simple as passing the annotation to the StateGraph constructor:

```
import { StateGraph } from "@langchain/langgraph";

const workflow = new StateGraph(MergedAnnotation);
```

State channels
The Annotation function is a convince wrapper around the low level implementation of how states are defined in LangGraph. Defining state using the channels object (which is what Annotation is a wrapper of) is still possible, although not recommended for most cases. The below example shows how to implement a graph using this pattern:

```
import { StateGraph } from "@langchain/langgraph";

interface WorkflowChannelsState {
  messages: BaseMessage[];
  question: string;
  answer: string;
}

const workflowWithChannels = new StateGraph<WorkflowChannelsState>({
  channels: {
    messages: {
      reducer: (currentState, updateValue) => currentState.concat(updateValue),
      default: () => [],
    },
    question: null,
    answer: null,
  }
});
```

Above, we set the value of question and answer to null, as it does not contain a default value. To set a default value, the channel should be implemented how the messages key is, with the default factory returing the default value. The reducer function is optional, and can be added to the channel object if needed.


# How to add and use subgraphs
Prerequisites

This guide assumes familiarity with the following:

*   [Subgraphs](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#subgraphs)
*   [State](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state)

[Subgraphs](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#subgraphs) allow you to build complex systems with multiple components that are themselves graphs. A common use case for using subgraphs is building [multi-agent systems](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent).

The main question when adding subgraphs is how the parent graph and subgraph communicate, i.e. how they pass the [state](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state) between each other during the graph execution. There are two scenarios:

*   parent graph and subgraph **share schema keys**. In this case, you can [add a node with the compiled subgraph](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/#add-a-node-with-the-compiled-subgraph)
*   parent graph and subgraph have **different schemas**. In this case, you have to [add a node function that invokes the subgraph](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/#add-a-node-function-that-invokes-the-subgraph): this is useful when the parent graph and the subgraph have different state schemas and you need to transform state before or after calling the subgraph

Below we show to to add subgraphs for each scenario.

![Image 5: Screenshot 2024-07-11 at 1.01.28 PM.png](blob:https://langchain-ai.github.io/55704d65fbeb050779650d772fb93dcf)

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/#setup)
----------------------------------------------------------------------------

First, let's install the required packages

```
npm install @langchain/langgraph @langchain/core
```

Set up [LangSmith](https://smith.langchain.com/) for LangGraph development

Sign up for LangSmith to quickly spot issues and improve the performance of your LangGraph projects. LangSmith lets you use trace data to debug, test, and monitor your LLM apps built with LangGraph — read more about how to get started [here](https://docs.smith.langchain.com/).

Add a node with the compiled subgraph[¶](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/#add-a-node-with-the-compiled-subgraph)
--------------------------------------------------------------------------------------------------------------------------------------------

A common case is for the parent graph and subgraph to communicate over a shared state key (channel). For example, in [multi-agent](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent) systems, the agents often communicate over a shared [messages](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#why-use-messages) key.

If your subgraph shares state keys with the parent graph, you can follow these steps to add it to your graph:

1.  Define the subgraph workflow (`subgraphBuilder` in the example below) and compile it
2.  Pass compiled subgraph to the `.addNode` method when defining the parent graph workflow

Let's take a look at an example.


```
import { StateGraph, Annotation } from "@langchain/langgraph";

const SubgraphStateAnnotation \= Annotation.Root({
  foo: Annotation<string\>, // note that this key is shared with the parent graph state
  bar: Annotation<string\>,
});

const subgraphNode1 \= async (state: typeof SubgraphStateAnnotation.State) \=\> {
  return { bar: "bar" };
};

const subgraphNode2 \= async (state: typeof SubgraphStateAnnotation.State) \=\> {
  // note that this node is using a state key ('bar') that is only available in the subgraph
  // and is sending update on the shared state key ('foo')
  return { foo: state.foo + state.bar };
};

const subgraphBuilder \= new StateGraph(SubgraphStateAnnotation)
  .addNode("subgraphNode1", subgraphNode1)
  .addNode("subgraphNode2", subgraphNode2)
  .addEdge("\_\_start\_\_", "subgraphNode1")
  .addEdge("subgraphNode1", "subgraphNode2")

const subgraph \= subgraphBuilder.compile();

// Define parent graph
const ParentStateAnnotation \= Annotation.Root({
  foo: Annotation<string\>,
});

const node1 \= async (state: typeof ParentStateAnnotation.State) \=\> {
  return {
    foo: "hi! " + state.foo,
  };
}

const builder \= new StateGraph(ParentStateAnnotation)
  .addNode("node1", node1)
  // note that we're adding the compiled subgraph as a node to the parent graph
  .addNode("node2", subgraph)
  .addEdge("\_\_start\_\_", "node1")
  .addEdge("node1", "node2")

const graph \= builder.compile();
```

```
const stream \= await graph.stream({ foo: "foo" });

for await (const chunk of stream) {
  console.log(chunk);
}
```

{ node1: { foo: 'hi! foo' } }
{ node2: { foo: 'hi! foobar' } }

You can see that the final output from the parent graph includes the results of subgraph invocation (the string `"bar"`).

If you would like to see streaming output from the subgraph, you can specify `subgraphs: True` when streaming. See more on streaming from subgraphs in this [how-to guide](https://langchain-ai.github.io/langgraphjs/how-tos/streaming-subgraphs/#stream-subgraph).

```
const streamWithSubgraphs \= await graph.stream({ foo: "foo" }, { subgraphs: true });

for await (const chunk of streamWithSubgraphs) {
  console.log(chunk);
}
```

\[ \[\], { node1: { foo: 'hi! foo' } } \]
\[
  \[ 'node2:22f27b01-fa9f-5f46-9b5b-166a80d96791' \],
  { subgraphNode1: { bar: 'bar' } }
\]
\[
  \[ 'node2:22f27b01-fa9f-5f46-9b5b-166a80d96791' \],
  { subgraphNode2: { foo: 'hi! foobar' } }
\]
\[ \[\], { node2: { foo: 'hi! foobar' } } \]

You'll notice that the chunk output format has changed to include some additional information about the subgraph it came from.

Add a node function that invokes the subgraph[¶](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/#add-a-node-function-that-invokes-the-subgraph)
------------------------------------------------------------------------------------------------------------------------------------------------------------

For more complex systems you might want to define subgraphs that have a completely different schema from the parent graph (no shared keys). For example, in a multi-agent RAG system, a search agent might only need to keep track of queries and retrieved documents.

If that's the case for your application, you need to define a node **function that invokes the subgraph**. This function needs to transform the input (parent) state to the subgraph state before invoking the subgraph, and transform the results back to the parent state before returning the state update from the node.

Below we show how to modify our original example to call a subgraph from inside the node.

Note

You **cannot** invoke more than one subgraph inside the same node if you have checkpointing enabled for the subgraphs. See [this page](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph-persistence#define-the-graph-with-persistence) for more information.


```
import { StateGraph, Annotation } from "@langchain/langgraph";

const SubgraphAnnotation \= Annotation.Root({
  bar: Annotation<string\>, // note that this key is shared with the parent graph state
  baz: Annotation<string\>,
});

const subgraphNodeOne \= async (state: typeof SubgraphAnnotation.State) \=\> {
  return { baz: "baz" };
};

const subgraphNodeTwo \= async (state: typeof SubgraphAnnotation.State) \=\> {
  return { bar: state.bar + state.baz }
};

const subgraphCalledInFunction \= new StateGraph(SubgraphAnnotation)
  .addNode("subgraphNode1", subgraphNodeOne)
  .addNode("subgraphNode2", subgraphNodeTwo)
  .addEdge("\_\_start\_\_", "subgraphNode1")
  .addEdge("subgraphNode1", "subgraphNode2")
  .compile();

// Define parent graph
const ParentAnnotation \= Annotation.Root({
  foo: Annotation<string\>,
});

const nodeOne \= async (state: typeof ParentAnnotation.State) \=\> {
  return {
    foo: "hi! " + state.foo,
  };
}

const nodeTwo \= async (state: typeof ParentAnnotation.State) \=\> {
  const response \= await subgraphCalledInFunction.invoke({
    bar: state.foo,
  });
  return { foo: response.bar }
}

const graphWithFunction \= new StateGraph(ParentStateAnnotation)
  .addNode("node1", nodeOne)
  // note that we're adding the compiled subgraph as a node to the parent graph
  .addNode("node2", nodeTwo)
  .addEdge("\_\_start\_\_", "node1")
  .addEdge("node1", "node2")
  .compile();
```

```
const graphWithFunctionStream \= await graphWithFunction.stream({ foo: "foo" }, { subgraphs: true });
for await (const chunk of graphWithFunctionStream) {
  console.log(chunk);
}
```

\[ \[\], { node1: { foo: 'hi! foo' } } \]
\[
  \[ 'node2:1d2bb11a-3ed1-5c58-9b6f-c7af36a1eeb7' \],
  { subgraphNode1: { baz: 'baz' } }
\]
\[
  \[ 'node2:1d2bb11a-3ed1-5c58-9b6f-c7af36a1eeb7' \],
  { subgraphNode2: { bar: 'hi! foobaz' } }
\]
\[ \[\], { node2: { foo: 'hi! foobaz' } } \]

# How to create branches for parallel node execution

LangGraph natively supports fan-out and fan-in using either regular edges or [conditionalEdges](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html#addConditionalEdges).

This lets you run nodes in parallel to speed up your total graph execution.

Below are some examples showing how to add create branching dataflows that work for you.

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/branching/#setup)
-----------------------------------------------------------------------------

First, install LangGraph.js

```
yarn add @langchain/langgraph @langchain/core
```

This guide will use OpenAI's GPT-4o model. We will optionally set our API key for [LangSmith tracing](https://smith.langchain.com/), which will give us best-in-class observability.


```
// process.env.OPENAI\_API\_KEY = "sk\_...";

// Optional, add tracing in LangSmith
// process.env.LANGCHAIN\_API\_KEY = "ls\_\_..."
// process.env.LANGCHAIN\_CALLBACKS\_BACKGROUND = "true";
process.env.LANGCHAIN\_CALLBACKS\_BACKGROUND \= "true";
process.env.LANGCHAIN\_TRACING\_V2 \= "true";
process.env.LANGCHAIN\_PROJECT \= "Branching: LangGraphJS";
```


Fan out, fan in[¶](https://langchain-ai.github.io/langgraphjs/how-tos/branching/#fan-out-fan-in)
------------------------------------------------------------------------------------------------

First, we will make a simple graph that branches out and back in. When merging back in, the state updates from all branches are applied by your **reducer** (the `aggregate` method below).

```
import { END, START, StateGraph, Annotation } from "@langchain/langgraph";

const StateAnnotation \= Annotation.Root({
  aggregate: Annotation<string\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  })
});

// Create the graph
const nodeA \= (state: typeof StateAnnotation.State) \=\> {
  console.log(\`Adding I'm A to ${state.aggregate}\`);
  return { aggregate: \[\`I'm A\`\] };
};
const nodeB \= (state: typeof StateAnnotation.State) \=\> {
  console.log(\`Adding I'm B to ${state.aggregate}\`);
  return { aggregate: \[\`I'm B\`\] };
};
const nodeC \= (state: typeof StateAnnotation.State) \=\> {
  console.log(\`Adding I'm C to ${state.aggregate}\`);
  return { aggregate: \[\`I'm C\`\] };
};
const nodeD \= (state: typeof StateAnnotation.State) \=\> {
  console.log(\`Adding I'm D to ${state.aggregate}\`);
  return { aggregate: \[\`I'm D\`\] };
};

const builder \= new StateGraph(StateAnnotation)
  .addNode("a", nodeA)
  .addEdge(START, "a")
  .addNode("b", nodeB)
  .addNode("c", nodeC)
  .addNode("d", nodeD)
  .addEdge("a", "b")
  .addEdge("a", "c")
  .addEdge("b", "d")
  .addEdge("c", "d")
  .addEdge("d", END);

const graph \= builder.compile();
```


```
import \* as tslab from "tslab";

const representation \= graph.getGraph();
const image \= await representation.drawMermaidPng();
const arrayBuffer \= await image.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer));
```

```
// Invoke the graph
const baseResult \= await graph.invoke({ aggregate: \[\] });
console.log("Base Result: ", baseResult);
```
Adding I'm A to 
Adding I'm B to I'm A
Adding I'm C to I'm A
Adding I'm D to I'm A,I'm B,I'm C
Base Result:  { aggregate: \[ "I'm A", "I'm B", "I'm C", "I'm D" \] }

Conditional Branching[¶](https://langchain-ai.github.io/langgraphjs/how-tos/branching/#conditional-branching)
-------------------------------------------------------------------------------------------------------------

If your fan-out is not deterministic, you can use [addConditionalEdges](https://langchain-ai.github.io/langgraphjs/reference/classes/index.StateGraph.html#addConditionalEdges) directly like this:

```
const ConditionalBranchingAnnotation \= Annotation.Root({
  aggregate: Annotation<string\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
  which: Annotation<string\>({
    reducer: (x: string, y: string) \=\> (y ?? x),
  })
})

// Create the graph
const nodeA2 \= (state: typeof ConditionalBranchingAnnotation.State) \=\> {
  console.log(\`Adding I'm A to ${state.aggregate}\`);
  return { aggregate: \[\`I'm A\`\] };
};
const nodeB2 \= (state: typeof ConditionalBranchingAnnotation.State) \=\> {
  console.log(\`Adding I'm B to ${state.aggregate}\`);
  return { aggregate: \[\`I'm B\`\] };
};
const nodeC2 \= (state: typeof ConditionalBranchingAnnotation.State) \=\> {
  console.log(\`Adding I'm C to ${state.aggregate}\`);
  return { aggregate: \[\`I'm C\`\] };
};
const nodeD2 \= (state: typeof ConditionalBranchingAnnotation.State) \=\> {
  console.log(\`Adding I'm D to ${state.aggregate}\`);
  return { aggregate: \[\`I'm D\`\] };
};
const nodeE2 \= (state: typeof ConditionalBranchingAnnotation.State) \=\> {
  console.log(\`Adding I'm E to ${state.aggregate}\`);
  return { aggregate: \[\`I'm E\`\] };
};

// Define the route function
function routeCDorBC(state: typeof ConditionalBranchingAnnotation.State): string\[\] {
  if (state.which \=== "cd") {
    return \["c", "d"\];
  }
  return \["b", "c"\];
}

const builder2 \= new StateGraph(ConditionalBranchingAnnotation)
  .addNode("a", nodeA2)
  .addEdge(START, "a")
  .addNode("b", nodeB2)
  .addNode("c", nodeC2)
  .addNode("d", nodeD2)
  .addNode("e", nodeE2)
  // Add conditional edges
  // Third parameter is to support visualizing the graph
  .addConditionalEdges("a", routeCDorBC, \["b", "c", "d"\])
  .addEdge("b", "e")
  .addEdge("c", "e")
  .addEdge("d", "e")
  .addEdge("e", END);

const graph2 \= builder2.compile();
```

```
import \* as tslab from "tslab";

const representation2 \= graph2.getGraph();
const image2 \= await representation2.drawMermaidPng();
const arrayBuffer2 \= await image2.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer2));
```

```
// Invoke the graph
let g2result \= await graph2.invoke({ aggregate: \[\], which: "bc" });
console.log("Result 1: ", g2result);
```

Adding I'm A to 
Adding I'm B to I'm A
Adding I'm C to I'm A
Adding I'm E to I'm A,I'm B,I'm C
Result 1:  { aggregate: \[ "I'm A", "I'm B", "I'm C", "I'm E" \], which: 'bc' }

```
g2result \= await graph2.invoke({ aggregate: \[\], which: "cd" });
console.log("Result 2: ", g2result);
```

Adding I'm A to 
Adding I'm C to I'm A
Adding I'm D to I'm A
Adding I'm E to I'm A,I'm C,I'm D
Result 2:  { aggregate: \[ "I'm A", "I'm C", "I'm D", "I'm E" \], which: 'cd' }


Stable Sorting[¶](https://langchain-ai.github.io/langgraphjs/how-tos/branching/#stable-sorting)
-----------------------------------------------------------------------------------------------

When fanned out, nodes are run in parallel as a single "superstep". The updates from each superstep are all applied to the state in sequence once the superstep has completed.

If you need consistent, predetermined ordering of updates from a parallel superstep, you should write the outputs (along with an identifying key) to a separate field in your state, then combine them in the "sink" node by adding regular `edge`s from each of the fanout nodes to the rendezvous point.

For instance, suppose I want to order the outputs of the parallel step by "reliability".

```
type ScoredValue \= {
  value: string;
  score: number;
};

const reduceFanouts \= (left?: ScoredValue\[\], right?: ScoredValue\[\]) \=\> {
  if (!left) {
    left \= \[\];
  }
  if (!right || right?.length \=== 0) {
    // Overwrite. Similar to redux.
    return \[\];
  }
  return left.concat(right);
};

const StableSortingAnnotation \= Annotation.Root({
  aggregate: Annotation<string\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
  which: Annotation<string\>({
    reducer: (x: string, y: string) \=\> (y ?? x),
  }),
  fanoutValues: Annotation<ScoredValue\[\]\>({
    reducer: reduceFanouts,
  }),
})

class ParallelReturnNodeValue {
  private \_value: string;
  private \_score: number;

  constructor(nodeSecret: string, score: number) {
    this.\_value \= nodeSecret;
    this.\_score \= score;
  }

  public call(state: typeof StableSortingAnnotation.State) {
    console.log(\`Adding ${this.\_value} to ${state.aggregate}\`);
    return { fanoutValues: \[{ value: this.\_value, score: this.\_score }\] };
  }
}

// Create the graph

const nodeA3 \= (state: typeof StableSortingAnnotation.State) \=\> {
  console.log(\`Adding I'm A to ${state.aggregate}\`);
  return { aggregate: \["I'm A"\] };
};

const nodeB3 \= new ParallelReturnNodeValue("I'm B", 0.1);
const nodeC3 \= new ParallelReturnNodeValue("I'm C", 0.9);
const nodeD3 \= new ParallelReturnNodeValue("I'm D", 0.3);

const aggregateFanouts \= (state: typeof StableSortingAnnotation.State) \=\> {
  // Sort by score (reversed)
  state.fanoutValues.sort((a, b) \=\> b.score \- a.score);
  return {
    aggregate: state.fanoutValues.map((v) \=\> v.value).concat(\["I'm E"\]),
    fanoutValues: \[\],
  };
};

// Define the route function
function routeBCOrCD(state: typeof StableSortingAnnotation.State): string\[\] {
  if (state.which \=== "cd") {
    return \["c", "d"\];
  }
  return \["b", "c"\];
}

const builder3 \= new StateGraph(StableSortingAnnotation)
  .addNode("a", nodeA3)
  .addEdge(START, "a")
  .addNode("b", nodeB3.call.bind(nodeB3))
  .addNode("c", nodeC3.call.bind(nodeC3))
  .addNode("d", nodeD3.call.bind(nodeD3))
  .addNode("e", aggregateFanouts)
  .addConditionalEdges("a", routeBCOrCD, \["b", "c", "d"\])
  .addEdge("b", "e")
  .addEdge("c", "e")
  .addEdge("d", "e")
  .addEdge("e", END);

const graph3 \= builder3.compile();

// Invoke the graph
let g3result \= await graph3.invoke({ aggregate: \[\], which: "bc" });
console.log("Result 1: ", g3result);
```

Adding I'm A to 
Adding I'm B to I'm A
Adding I'm C to I'm A
Result 1:  {
  aggregate: \[ "I'm A", "I'm C", "I'm B", "I'm E" \],
  which: 'bc',
  fanoutValues: \[\]
}

Our aggregateFanouts "sink" node in this case took the mapped values and then sorted them in a consistent way. Notice that, because it returns an empty array for `fanoutValues`, our `reduceFanouts` reducer function decided to overwrite the previous values in the state.

```
let g3result2 \= await graph3.invoke({ aggregate: \[\], which: "cd" });
console.log("Result 2: ", g3result2);
```
Adding I'm A to 
Adding I'm C to I'm A
Adding I'm D to I'm A
Result 2:  {
  aggregate: \[ "I'm A", "I'm C", "I'm D", "I'm E" \],
  which: 'cd',
  fanoutValues: \[\]
}

# How to create map-reduce branches for parallel execution
[Map-reduce](https://en.wikipedia.org/wiki/MapReduce) operations are essential for efficient task decomposition and parallel processing. This approach involves breaking a task into smaller sub-tasks, processing each sub-task in parallel, and aggregating the results across all of the completed sub-tasks.

Consider this example: given a general topic from the user, generate a list of related subjects, generate a joke for each subject, and select the best joke from the resulting list. In this design pattern, a first node may generate a list of objects (e.g., related subjects) and we want to apply some other node (e.g., generate a joke) to all those objects (e.g., subjects). However, two main challenges arise.

(1) the number of objects (e.g., subjects) may be unknown ahead of time (meaning the number of edges may not be known) when we lay out the graph and (2) the input State to the downstream Node should be different (one for each generated object).

LangGraph addresses these challenges [through its `Send` API](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#send). By utilizing conditional edges, `Send` can distribute different states (e.g., subjects) to multiple instances of a node (e.g., joke generation). Importantly, the sent state can differ from the core graph's state, allowing for flexible and dynamic workflow management.

![Image 5: Screenshot 2024-07-12 at 9.45.40 AM.png](blob:https://langchain-ai.github.io/5157074c35ded154bfa8765b62031d0a)

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/map-reduce/#setup)
------------------------------------------------------------------------------

This example will require a few dependencies. First, install the LangGraph library, along with the `@langchain/anthropic` package as we'll be using Anthropic LLMs in this example:

```
npm install @langchain/langgraph @langchain/anthropic @langchain/core
```

Next, set your Anthropic API key:

```
process.env.ANTHROPIC\_API\_KEY \= 'YOUR\_API\_KEY'
```

```
import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, END, START, Annotation, Send } from "@langchain/langgraph";

/\* Model and prompts \*/

// Define model and prompts we will use
const subjectsPrompt \= "Generate a comma separated list of between 2 and 5 examples related to: {topic}."
const jokePrompt \= "Generate a joke about {subject}"
const bestJokePrompt \= \`Below are a bunch of jokes about {topic}. Select the best one! Return the ID (index) of the best one.

{jokes}\`

// Zod schemas for getting structured output from the LLM
const Subjects \= z.object({
  subjects: z.array(z.string()),
});
const Joke \= z.object({
  joke: z.string(),
});
const BestJoke \= z.object({
  id: z.number(),
});

const model \= new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
});

/\* Graph components: define the components that will make up the graph \*/

// This will be the overall state of the main graph.
// It will contain a topic (which we expect the user to provide)
// and then will generate a list of subjects, and then a joke for
// each subject
const OverallState \= Annotation.Root({
  topic: Annotation<string\>,
  subjects: Annotation<string\[\]\>,
  // Notice here we pass a reducer function.
  // This is because we want combine all the jokes we generate
  // from individual nodes back into one list.
  jokes: Annotation<string\[\]\>({
    reducer: (state, update) \=\> state.concat(update),
  }),
  bestSelectedJoke: Annotation<string\>,
});

// This will be the state of the node that we will "map" all
// subjects to in order to generate a joke
interface JokeState {
  subject: string;
}

// This is the function we will use to generate the subjects of the jokes
const generateTopics \= async (
  state: typeof OverallState.State
): Promise<Partial<typeof OverallState.State\>\> \=\> {
  const prompt \= subjectsPrompt.replace("topic", state.topic);
  const response \= await model
    .withStructuredOutput(Subjects, { name: "subjects" })
    .invoke(prompt);
  return { subjects: response.subjects };
};

// Function to generate a joke
const generateJoke \= async (state: JokeState): Promise<{ jokes: string\[\] }\> \=\> {
  const prompt \= jokePrompt.replace("subject", state.subject);
  const response \= await model
    .withStructuredOutput(Joke, { name: "joke" })
    .invoke(prompt);
  return { jokes: \[response.joke\] };
};

// Here we define the logic to map out over the generated subjects
// We will use this an edge in the graph
const continueToJokes \= (state: typeof OverallState.State) \=\> {
  // We will return a list of \`Send\` objects
  // Each \`Send\` object consists of the name of a node in the graph
  // as well as the state to send to that node
  return state.subjects.map((subject) \=\> new Send("generateJoke", { subject }));
};

// Here we will judge the best joke
const bestJoke \= async (
  state: typeof OverallState.State
): Promise<Partial<typeof OverallState.State\>\> \=\> {
  const jokes \= state.jokes.join("\\n\\n");
  const prompt \= bestJokePrompt
    .replace("jokes", jokes)
    .replace("topic", state.topic);
  const response \= await model
    .withStructuredOutput(BestJoke, { name: "best\_joke" })
    .invoke(prompt);
  return { bestSelectedJoke: state.jokes\[response.id\] };
};

// Construct the graph: here we put everything together to construct our graph
const graph \= new StateGraph(OverallState)
  .addNode("generateTopics", generateTopics)
  .addNode("generateJoke", generateJoke)
  .addNode("bestJoke", bestJoke)
  .addEdge(START, "generateTopics")
  .addConditionalEdges("generateTopics", continueToJokes)
  .addEdge("generateJoke", "bestJoke")
  .addEdge("bestJoke", END);

const app \= graph.compile();
```

```
import \* as tslab from "tslab";

const representation \= app.getGraph();
const image \= await representation.drawMermaidPng();
const arrayBuffer \= await image.arrayBuffer();

tslab.display.png(new Uint8Array(arrayBuffer));
```

```
// Call the graph: here we call it to generate a list of jokes
for await (const s of await app.stream({ topic: "animals" })) {
  console.log(s);
}
```

{
  generateTopics: { subjects: \[ 'lion', 'elephant', 'penguin', 'dolphin' \] }
}
{
  generateJoke: {
    jokes: \[ "Why don't lions like fast food? Because they can't catch it!" \]
  }
}
{
  generateJoke: {
    jokes: \[
      "Why don't elephants use computers? Because they're afraid of the mouse!"
    \]
  }
}
{
  generateJoke: {
    jokes: \[
      "Why don't dolphins use smartphones? They're afraid of phishing!"
    \]
  }
}
{
  generateJoke: {
    jokes: \[
      "Why don't you see penguins in Britain? Because they're afraid of Wales!"
    \]
  }
}
{
  bestJoke: {
    bestSelectedJoke: "Why don't elephants use computers? Because they're afraid of the mouse!"
  }
}

# How to stream full state of your graph¶

LangGraph supports multiple streaming modes. The main ones are:

*   `values`: This streaming mode streams back values of the graph. This is the **full state of the graph** after each node is called.
*   `updates`: This streaming mode streams back updates to the graph. This is the **update to the state of the graph** after each node is called.

This guide covers `streamMode="values"`.

```
// process.env.OPENAI\_API\_KEY = "sk-...";
```

Define the state[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/#define-the-state)
-------------------------------------------------------------------------------------------------------

The state is the interface for all of the nodes in our graph.

```
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const StateAnnotation \= Annotation.Root({
  messages: Annotation<BaseMessage\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
});
```

Set up the tools[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/#set-up-the-tools)
-------------------------------------------------------------------------------------------------------

We will first define the tools we want to use. For this simple example, we will use create a placeholder search engine. However, it is really easy to create your own tools - see documentation [here](https://js.langchain.com/docs/how_to/custom_tools) on how to do that.

```
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool \= tool(async ({ query: \_query }: { query: string }) \=\> {
  // This is a placeholder for the actual implementation
  return "Cold, with a low of 3℃";
}, {
  name: "search",
  description:
    "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
  schema: z.object({
    query: z.string().describe("The query to use in your search."),
  }),
});

await searchTool.invoke({ query: "What's the weather like?" });

const tools \= \[searchTool\];
```

We can now wrap these tools in a simple [ToolNode](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html). This object will actually run the tools (functions) whenever they are invoked by our LLM.

```
import { ToolNode } from "@langchain/langgraph/prebuilt";

const toolNode \= new ToolNode(tools);
```

Set up the model[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/#set-up-the-model)
-------------------------------------------------------------------------------------------------------

Now we will load the [chat model](https://js.langchain.com/docs/concepts/chat_models/).

1.  It should work with messages. We will represent all agent state in the form of messages, so it needs to be able to work well with them.
2.  It should work with [tool calling](https://js.langchain.com/docs/how_to/tool_calling/#passing-tools-to-llms), meaning it can return function arguments in its response.

Note

These model requirements are not general requirements for using LangGraph - they are just requirements for this one example.


```
import { ChatOpenAI } from "@langchain/openai";

const model \= new ChatOpenAI({ model: "gpt-4o" });
```

After we've done this, we should make sure the model knows that it has these tools available to call. We can do this by calling [bindTools](https://v01.api.js.langchain.com/classes/langchain_core_language_models_chat_models.BaseChatModel.html#bindTools).

```
const boundModel \= model.bindTools(tools);
```

Define the graph[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/#define-the-graph)
-------------------------------------------------------------------------------------------------------

We can now put it all together.

```
import { END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

const routeMessage \= (state: typeof StateAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\] as AIMessage;
  // If no tools are called, we can finish (respond to the user)
  if (!lastMessage?.tool\_calls?.length) {
    return END;
  }
  // Otherwise if there is, we continue and call the tools
  return "tools";
};

const callModel \= async (
  state: typeof StateAnnotation.State,
) \=\> {
  // For versions of @langchain/core < 0.2.3, you must call \`.stream()\`
  // and aggregate the message from chunks instead of calling \`.invoke()\`.
  const { messages } \= state;
  const responseMessage \= await boundModel.invoke(messages);
  return { messages: \[responseMessage\] };
};

const workflow \= new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routeMessage)
  .addEdge("tools", "agent");

const graph \= workflow.compile();
```


Stream values[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/#stream-values)
-------------------------------------------------------------------------------------------------

We can now interact with the agent. Between interactions you can get and update state.

```
let inputs \= { messages: \[{ role: "user", content: "what's the weather in sf" }\] };

for await (
  const chunk of await graph.stream(inputs, {
    streamMode: "values",
  })
) {
  console.log(chunk\["messages"\]);
  console.log("\\n====\\n");
}
```


\[ \[ 'user', "what's the weather in sf" \] \]

====

\[
  \[ 'user', "what's the weather in sf" \],
  AIMessage {
    "id": "chatcmpl-9y660d49eLzT7DZeBk2ZmX8C5f0LU",
    "content": "",
    "additional\_kwargs": {
      "tool\_calls": \[
        {
          "id": "call\_iD5Wk4vPsTckffDKJpEQaMkg",
          "type": "function",
          "function": "\[Object\]"
        }
      \]
    },
    "response\_metadata": {
      "tokenUsage": {
        "completionTokens": 17,
        "promptTokens": 70,
        "totalTokens": 87
      },
      "finish\_reason": "tool\_calls",
      "system\_fingerprint": "fp\_3aa7262c27"
    },
    "tool\_calls": \[
      {
        "name": "search",
        "args": {
          "query": "current weather in San Francisco"
        },
        "type": "tool\_call",
        "id": "call\_iD5Wk4vPsTckffDKJpEQaMkg"
      }
    \],
    "invalid\_tool\_calls": \[\],
    "usage\_metadata": {
      "input\_tokens": 70,
      "output\_tokens": 17,
      "total\_tokens": 87
    }
  }
\]

====

\[
  \[ 'user', "what's the weather in sf" \],
  AIMessage {
    "id": "chatcmpl-9y660d49eLzT7DZeBk2ZmX8C5f0LU",
    "content": "",
    "additional\_kwargs": {
      "tool\_calls": \[
        {
          "id": "call\_iD5Wk4vPsTckffDKJpEQaMkg",
          "type": "function",
          "function": "\[Object\]"
        }
      \]
    },
    "response\_metadata": {
      "tokenUsage": {
        "completionTokens": 17,
        "promptTokens": 70,
        "totalTokens": 87
      },
      "finish\_reason": "tool\_calls",
      "system\_fingerprint": "fp\_3aa7262c27"
    },
    "tool\_calls": \[
      {
        "name": "search",
        "args": {
          "query": "current weather in San Francisco"
        },
        "type": "tool\_call",
        "id": "call\_iD5Wk4vPsTckffDKJpEQaMkg"
      }
    \],
    "invalid\_tool\_calls": \[\],
    "usage\_metadata": {
      "input\_tokens": 70,
      "output\_tokens": 17,
      "total\_tokens": 87
    }
  },
  ToolMessage {
    "content": "Cold, with a low of 3℃",
    "name": "search",
    "additional\_kwargs": {},
    "response\_metadata": {},
    "tool\_call\_id": "call\_iD5Wk4vPsTckffDKJpEQaMkg"
  }
\]

====

\[
  \[ 'user', "what's the weather in sf" \],
  AIMessage {
    "id": "chatcmpl-9y660d49eLzT7DZeBk2ZmX8C5f0LU",
    "content": "",
    "additional\_kwargs": {
      "tool\_calls": \[
        {
          "id": "call\_iD5Wk4vPsTckffDKJpEQaMkg",
          "type": "function",
          "function": "\[Object\]"
        }
      \]
    },
    "response\_metadata": {
      "tokenUsage": {
        "completionTokens": 17,
        "promptTokens": 70,
        "totalTokens": 87
      },
      "finish\_reason": "tool\_calls",
      "system\_fingerprint": "fp\_3aa7262c27"
    },
    "tool\_calls": \[
      {
        "name": "search",
        "args": {
          "query": "current weather in San Francisco"
        },
        "type": "tool\_call",
        "id": "call\_iD5Wk4vPsTckffDKJpEQaMkg"
      }
    \],
    "invalid\_tool\_calls": \[\],
    "usage\_metadata": {
      "input\_tokens": 70,
      "output\_tokens": 17,
      "total\_tokens": 87
    }
  },
  ToolMessage {
    "content": "Cold, with a low of 3℃",
    "name": "search",
    "additional\_kwargs": {},
    "response\_metadata": {},
    "tool\_call\_id": "call\_iD5Wk4vPsTckffDKJpEQaMkg"
  },
  AIMessage {
    "id": "chatcmpl-9y660ZKNXvziVJze0X5aTlZ5IoN35",
    "content": "Currently, in San Francisco, it's cold with a temperature of around 3℃ (37.4°F).",
    "additional\_kwargs": {},
    "response\_metadata": {
      "tokenUsage": {
        "completionTokens": 23,
        "promptTokens": 103,
        "totalTokens": 126
      },
      "finish\_reason": "stop",
      "system\_fingerprint": "fp\_3aa7262c27"
    },
    "tool\_calls": \[\],
    "invalid\_tool\_calls": \[\],
    "usage\_metadata": {
      "input\_tokens": 103,
      "output\_tokens": 23,
      "total\_tokens": 126
    }
  }
\]

====


# How to stream state updates of your graph

LangGraph supports multiple streaming modes. The main ones are:

*   `values`: This streaming mode streams back values of the graph. This is the **full state of the graph** after each node is called.
*   `updates`: This streaming mode streams back updates to the graph. This is the **update to the state of the graph** after each node is called.

This guide covers `streamMode="updates"`.

```
// process.env.OPENAI\_API\_KEY = "sk-...";
```

Define the state[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-updates/#define-the-state)
--------------------------------------------------------------------------------------------------------

The state is the interface for all of the nodes in our graph.

```
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const StateAnnotation \= Annotation.Root({
  messages: Annotation<BaseMessage\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
});
```

Set up the tools[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-updates/#set-up-the-tools)
--------------------------------------------------------------------------------------------------------

We will first define the tools we want to use. For this simple example, we will use create a placeholder search engine. However, it is really easy to create your own tools - see documentation [here](https://js.langchain.com/docs/how_to/custom_tools) on how to do that.

```
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool \= tool(async ({ query: \_query }: { query: string }) \=\> {
  // This is a placeholder for the actual implementation
  return "Cold, with a low of 3℃";
}, {
  name: "search",
  description:
    "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
  schema: z.object({
    query: z.string().describe("The query to use in your search."),
  }),
});

await searchTool.invoke({ query: "What's the weather like?" });

const tools \= \[searchTool\];
```

We can now wrap these tools in a simple [ToolNode](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html). This object will actually run the tools (functions) whenever they are invoked by our LLM.

```
import { ToolNode } from "@langchain/langgraph/prebuilt";

const toolNode \= new ToolNode(tools);
```

Set up the model[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-updates/#set-up-the-model)
--------------------------------------------------------------------------------------------------------

Now we will load the [chat model](https://js.langchain.com/docs/concepts/chat_models/).

1.  It should work with messages. We will represent all agent state in the form of messages, so it needs to be able to work well with them.
2.  It should work with [tool calling](https://js.langchain.com/docs/how_to/tool_calling/#passing-tools-to-llms), meaning it can return function arguments in its response.

Note

These model requirements are not general requirements for using LangGraph - they are just requirements for this one example.

```
import { ChatOpenAI } from "@langchain/openai";

const model \= new ChatOpenAI({ model: "gpt-4o" });
```

After we've done this, we should make sure the model knows that it has these tools available to call. We can do this by calling [bindTools](https://v01.api.js.langchain.com/classes/langchain_core_language_models_chat_models.BaseChatModel.html#bindTools).

```
const boundModel \= model.bindTools(tools);
```

Define the graph[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-updates/#define-the-graph)
--------------------------------------------------------------------------------------------------------

We can now put it all together.

```
import { END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

const routeMessage \= (state: typeof StateAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\] as AIMessage;
  // If no tools are called, we can finish (respond to the user)
  if (!lastMessage?.tool\_calls?.length) {
    return END;
  }
  // Otherwise if there is, we continue and call the tools
  return "tools";
};

const callModel \= async (
  state: typeof StateAnnotation.State,
) \=\> {
  const { messages } \= state;
  const responseMessage \= await boundModel.invoke(messages);
  return { messages: \[responseMessage\] };
};

const workflow \= new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routeMessage)
  .addEdge("tools", "agent");

const graph \= workflow.compile();
```

Stream updates[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-updates/#stream-updates)
----------------------------------------------------------------------------------------------------

We can now interact with the agent.

```
let inputs \= { messages: \[{ role: "user",  content: "what's the weather in sf" }\] };

for await (
  const chunk of await graph.stream(inputs, {
    streamMode: "updates",
  })
) {
  for (const \[node, values\] of Object.entries(chunk)) {
    console.log(\`Receiving update from node: ${node}\`);
    console.log(values);
    console.log("\\n====\\n");
  }
}
```


Receiving update from node: agent
{
  messages: \[
    AIMessage {
      "id": "chatcmpl-9y654VypbD3kE1xM8v4xaAHzZEOXa",
      "content": "",
      "additional\_kwargs": {
        "tool\_calls": \[
          {
            "id": "call\_OxlOhnROermwae2LPs9SanmD",
            "type": "function",
            "function": "\[Object\]"
          }
        \]
      },
      "response\_metadata": {
        "tokenUsage": {
          "completionTokens": 17,
          "promptTokens": 70,
          "totalTokens": 87
        },
        "finish\_reason": "tool\_calls",
        "system\_fingerprint": "fp\_3aa7262c27"
      },
      "tool\_calls": \[
        {
          "name": "search",
          "args": {
            "query": "current weather in San Francisco"
          },
          "type": "tool\_call",
          "id": "call\_OxlOhnROermwae2LPs9SanmD"
        }
      \],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 70,
        "output\_tokens": 17,
        "total\_tokens": 87
      }
    }
  \]
}

====

Receiving update from node: tools
{
  messages: \[
    ToolMessage {
      "content": "Cold, with a low of 3℃",
      "name": "search",
      "additional\_kwargs": {},
      "response\_metadata": {},
      "tool\_call\_id": "call\_OxlOhnROermwae2LPs9SanmD"
    }
  \]
}

====

Receiving update from node: agent
{
  messages: \[
    AIMessage {
      "id": "chatcmpl-9y654dZ0zzZhPYm6lb36FkG1Enr3p",
      "content": "It looks like it's currently quite cold in San Francisco, with a low temperature of around 3°C. Make sure to dress warmly!",
      "additional\_kwargs": {},
      "response\_metadata": {
        "tokenUsage": {
          "completionTokens": 28,
          "promptTokens": 103,
          "totalTokens": 131
        },
        "finish\_reason": "stop",
        "system\_fingerprint": "fp\_3aa7262c27"
      },
      "tool\_calls": \[\],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 103,
        "output\_tokens": 28,
        "total\_tokens": 131
      }
    }
  \]
}

====

# How to configure multiple streaming modes at the same time

This guide covers how to configure multiple streaming modes at the same time.

## Setup
First we need to install the packages required

```
npm install @langchain/langgraph @langchain/openai @langchain/core
```

Next, we need to set API keys for OpenAI (the LLM we will use)

```
export OPENAI_API_KEY=your-api-key
```

Optionally, we can set API key for LangSmith tracing, which will give us best-in-class observability.

```
export LANGCHAIN_TRACING_V2="true"
export LANGCHAIN_CALLBACKS_BACKGROUND="true"
export LANGCHAIN_API_KEY=your-api-key
```

## Define the graph
We'll be using a prebuilt ReAct agent for this guide.

```
import { ChatOpenAI } from "@langchain/openai";
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const model = new ChatOpenAI({
    model: "gpt-4o",
  });

const getWeather = tool((input) => {
  if (["sf", "san francisco", "san francisco, ca"].includes(input.location.toLowerCase())) {
    return "It's 60 degrees and foggy.";
  } else {
    return "It's 90 degrees and sunny.";
  }
}, {
  name: "get_weather",
  description: "Call to get the current weather.",
  schema: z.object({
    location: z.string().describe("Location to get the weather for."),
  })
})

const graph = createReactAgent({ llm: model, tools: [getWeather] });
```


## Stream Multiple
To get multiple types of streamed chunks, pass an array of values under the streamMode key in the second argument to .stream():

```
let inputs = { messages: [{ role: "user", content: "what's the weather in sf?" }] };

let stream = await graph.stream(inputs, {
  streamMode: ["updates", "debug"],
});

for await (const chunk of stream) {
  console.log(`Receiving new event of type: ${chunk[0]}`);
  console.log(chunk[1]);
  console.log("\n====\n");
}
```

Receiving new event of type: updates
{
  agent: {
    messages: \[
      AIMessage {
        "id": "chatcmpl-A22zqTwumhtW8TMjQ1FxlzCEMBk0R",
        "content": "",
        "additional\_kwargs": {
          "tool\_calls": \[
            {
              "id": "call\_HAfilebE1q9E9OQHOlL3JYHP",
              "type": "function",
              "function": "\[Object\]"
            }
          \]
        },
        "response\_metadata": {
          "tokenUsage": {
            "completionTokens": 15,
            "promptTokens": 59,
            "totalTokens": 74
          },
          "finish\_reason": "tool\_calls",
          "system\_fingerprint": "fp\_157b3831f5"
        },
        "tool\_calls": \[
          {
            "name": "get\_weather",
            "args": {
              "location": "San Francisco"
            },
            "type": "tool\_call",
            "id": "call\_HAfilebE1q9E9OQHOlL3JYHP"
          }
        \],
        "invalid\_tool\_calls": \[\],
        "usage\_metadata": {
          "input\_tokens": 59,
          "output\_tokens": 15,
          "total\_tokens": 74
        }
      }
    \]
  }
}

====

Receiving new event of type: debug
{
  type: 'task\_result',
  timestamp: '2024-08-30T20:58:59.072Z',
  step: 1,
  payload: {
    id: '768110dd-6004-59f3-8671-6ca699cccd71',
    name: 'agent',
    result: \[ \[Array\] \]
  }
}

====

Receiving new event of type: debug
{
  type: 'task',
  timestamp: '2024-08-30T20:58:59.074Z',
  step: 2,
  payload: {
    id: '76459c18-5621-5893-9b93-13bc1db3ba6d',
    name: 'tools',
    input: { messages: \[Array\] },
    triggers: \[ 'branch:agent:shouldContinue:tools' \],
    interrupts: \[\]
  }
}

====

Receiving new event of type: updates
{
  tools: {
    messages: \[
      ToolMessage {
        "content": "It's 60 degrees and foggy.",
        "name": "get\_weather",
        "additional\_kwargs": {},
        "response\_metadata": {},
        "tool\_call\_id": "call\_HAfilebE1q9E9OQHOlL3JYHP"
      }
    \]
  }
}

====

Receiving new event of type: debug
{
  type: 'task\_result',
  timestamp: '2024-08-30T20:58:59.076Z',
  step: 2,
  payload: {
    id: '76459c18-5621-5893-9b93-13bc1db3ba6d',
    name: 'tools',
    result: \[ \[Array\] \]
  }
}

====

Receiving new event of type: debug
{
  type: 'task',
  timestamp: '2024-08-30T20:58:59.077Z',
  step: 3,
  payload: {
    id: '565d8a53-1057-5d83-bda8-ba3fada24b70',
    name: 'agent',
    input: { messages: \[Array\] },
    triggers: \[ 'tools' \],
    interrupts: \[\]
  }
}

====

Receiving new event of type: updates
{
  agent: {
    messages: \[
      AIMessage {
        "id": "chatcmpl-A22zrdeobsBzkiES0C6Twh3p7I344",
        "content": "The weather in San Francisco right now is 60 degrees and foggy.",
        "additional\_kwargs": {},
        "response\_metadata": {
          "tokenUsage": {
            "completionTokens": 16,
            "promptTokens": 90,
            "totalTokens": 106
          },
          "finish\_reason": "stop",
          "system\_fingerprint": "fp\_157b3831f5"
        },
        "tool\_calls": \[\],
        "invalid\_tool\_calls": \[\],
        "usage\_metadata": {
          "input\_tokens": 90,
          "output\_tokens": 16,
          "total\_tokens": 106
        }
      }
    \]
  }
}


# How to stream LLM Token from your graph

In this example, we will stream tokens from the language model powering an agent. We will use a ReAct agent as an example. The tl;dr is to use [streamEvents](https://js.langchain.com/docs/how_to/chat_streaming/#stream-events) ([API Ref](https://api.js.langchain.com/classes/langchain_core_runnables.Runnable.html#streamEvents)).

Note

If you are using a version of `@langchain/core` < 0.2.3, when calling chat models or LLMs you need to call `await model.stream()` within your nodes to get token-by-token streaming events, and aggregate final outputs if needed to update the graph state. In later versions of `@langchain/core`, this occurs automatically, and you can call `await model.invoke()`.  
For more on how to upgrade `@langchain/core`, check out [the instructions here](https://js.langchain.com/docs/how_to/installation/#installing-integration-packages).

This how-to guide closely follows the others in this directory, showing how to incorporate the functionality into a prototypical agent in LangGraph.

Streaming Support

Token streaming is supported by many, but not all chat models. Check to see if your LLM integration supports token streaming [here (doc)](https://js.langchain.com/docs/integrations/chat/). Note that some integrations may support _general_ token streaming but lack support for streaming tool calls.

Note

In this how-to, we will create our agent from scratch to be transparent (but verbose). You can accomplish similar functionality using the `createReactAgent({ llm, tools })` ([API doc](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph_prebuilt.createReactAgent.html)) constructor. This may be more appropriate if you are used to LangChain's [AgentExecutor](https://js.langchain.com/docs/how_to/agent_executor) class.

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#setup)
---------------------------------------------------------------------------------

This guide will use OpenAI's GPT-4o model. We will optionally set our API key for [LangSmith tracing](https://smith.langchain.com/), which will give us best-in-class observability.

* * *


```
// process.env.OPENAI\_API\_KEY = "sk\_...";

// Optional, add tracing in LangSmith
// process.env.LANGCHAIN\_API\_KEY = "ls\_\_...";
// process.env.LANGCHAIN\_CALLBACKS\_BACKGROUND = "true";
// process.env.LANGCHAIN\_TRACING = "true";
// process.env.LANGCHAIN\_PROJECT = "Stream Tokens: LangGraphJS";
```

Define the state[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#define-the-state)
-------------------------------------------------------------------------------------------------------

The state is the interface for all of the nodes in our graph.

```
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const StateAnnotation \= Annotation.Root({
  messages: Annotation<BaseMessage\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
});
```

Set up the tools[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#set-up-the-tools)
-------------------------------------------------------------------------------------------------------

First define the tools you want to use. For this simple example, we'll create a placeholder search engine, but see the documentation [here](https://js.langchain.com/docs/how_to/custom_tools) on how to create your own custom tools.

```
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool \= tool((\_) \=\> {
  // This is a placeholder for the actual implementation
  return "Cold, with a low of 3℃";
}, {
  name: "search",
  description:
    "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
  schema: z.object({
    query: z.string().describe("The query to use in your search."),
  }),
});

await searchTool.invoke({ query: "What's the weather like?" });

const tools \= \[searchTool\];
```

We can now wrap these tools in a prebuilt [ToolNode](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html). This object will actually run the tools (functions) whenever they are invoked by our LLM.


```
import { ToolNode } from "@langchain/langgraph/prebuilt";

const toolNode \= new ToolNode(tools);
```

Set up the model[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#set-up-the-model)
-------------------------------------------------------------------------------------------------------

Now load the [chat model](https://js.langchain.com/docs/concepts/#chat-models).

1.  It should work with messages. We will represent all agent state in the form of messages, so it needs to be able to work well with them.
2.  It should work with [tool calling](https://js.langchain.com/docs/how_to/tool_calling/#passing-tools-to-llms), meaning it can return function arguments in its response.

Note

These model requirements are not general requirements for using LangGraph - they are just requirements for this one example.

```
import { ChatOpenAI } from "@langchain/openai";

const model \= new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  streaming: true
});
```

After you've done this, we should make sure the model knows that it has these tools available to call. We can do this by calling [bindTools](https://v01.api.js.langchain.com/classes/langchain_core_language_models_chat_models.BaseChatModel.html#bindTools).

```
const boundModel \= model.bindTools(tools);
```


Define the graph[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#define-the-graph)
-------------------------------------------------------------------------------------------------------

We can now put it all together.

```
import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

const routeMessage \= (state: typeof StateAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\] as AIMessage;
  // If no tools are called, we can finish (respond to the user)
  if (!lastMessage?.tool\_calls?.length) {
    return END;
  }
  // Otherwise if there is, we continue and call the tools
  return "tools";
};

const callModel \= async (
  state: typeof StateAnnotation.State,
) \=\> {
  // For versions of @langchain/core < 0.2.3, you must call \`.stream()\`
  // and aggregate the message from chunks instead of calling \`.invoke()\`.
  const { messages } \= state;
  const responseMessage \= await boundModel.invoke(messages);
  return { messages: \[responseMessage\] };
};

const workflow \= new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("\_\_start\_\_", "agent")
  .addConditionalEdges("agent", routeMessage)
  .addEdge("tools", "agent");

const agent \= workflow.compile();
```

```
import \* as tslab from "tslab";

const runnableGraph \= agent.getGraph();
const image \= await runnableGraph.drawMermaidPng();
const arrayBuffer \= await image.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer));
```

![Image 5: No description has been provided for this image](blob:https://langchain-ai.github.io/762c13ef00ea7c2641eb8fe70122ec93)

Streaming LLM Tokens[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#streaming-llm-tokens)
---------------------------------------------------------------------------------------------------------------

You can access the LLM tokens as they are produced by each node with two methods:

*   The `stream` method along with `streamMode: "messages"`
*   The `streamEvents` method

### The stream method[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#the-stream-method)

Compatibility

This guide requires `@langchain/langgraph>=0.2.20`. For help upgrading, see [this guide](https://langchain-ai.github.io/langgraphjs/how-tos/manage-ecosystem-dependencies/).

For this method, you must be using an LLM that supports streaming as well and enable it when constructing the LLM (e.g. `new ChatOpenAI({ model: "gpt-4o-mini", streaming: true })`) or call `.stream` on the internal LLM call.


```
import { isAIMessageChunk } from "@langchain/core/messages";

const stream \= await agent.stream(
  { messages: \[{ role: "user", content: "What's the current weather in Nepal?" }\] },
  { streamMode: "messages" },
);

for await (const \[message, \_metadata\] of stream) {
  if (isAIMessageChunk(message) && message.tool\_call\_chunks?.length) {
    console.log(\`${message.getType()} MESSAGE TOOL CALL CHUNK: ${message.tool\_call\_chunks\[0\].args}\`);
  } else {
    console.log(\`${message.getType()} MESSAGE CONTENT: ${message.content}\`);
  }
}
```

ai MESSAGE TOOL CALL CHUNK: 
ai MESSAGE TOOL CALL CHUNK: {"
ai MESSAGE TOOL CALL CHUNK: query
ai MESSAGE TOOL CALL CHUNK: ":"
ai MESSAGE TOOL CALL CHUNK: current
ai MESSAGE TOOL CALL CHUNK:  weather
ai MESSAGE TOOL CALL CHUNK:  in
ai MESSAGE TOOL CALL CHUNK:  Nepal
ai MESSAGE TOOL CALL CHUNK: "}
ai MESSAGE CONTENT: 
tool MESSAGE CONTENT: Cold, with a low of 3℃
ai MESSAGE CONTENT: 
ai MESSAGE CONTENT: The
ai MESSAGE CONTENT:  current
ai MESSAGE CONTENT:  weather
ai MESSAGE CONTENT:  in
ai MESSAGE CONTENT:  Nepal
ai MESSAGE CONTENT:  is
ai MESSAGE CONTENT:  cold
ai MESSAGE CONTENT: ,
ai MESSAGE CONTENT:  with
ai MESSAGE CONTENT:  a
ai MESSAGE CONTENT:  low
ai MESSAGE CONTENT:  temperature
ai MESSAGE CONTENT:  of
ai MESSAGE CONTENT:  
ai MESSAGE CONTENT: 3
ai MESSAGE CONTENT: ℃
ai MESSAGE CONTENT: .
ai MESSAGE CONTENT: 

### The streamEvents method[¶](https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/#the-streamevents-method)

You can also use the `streamEvents` method like this:

```
const eventStream \= await agent.streamEvents(
  { messages: \[{ role: "user", content: "What's the weather like today?" }\] },
  {
    version: "v2",
  }
);

for await (const { event, data } of eventStream) {
  if (event \=== "on\_chat\_model\_stream" && isAIMessageChunk(data.chunk)) {
    if (data.chunk.tool\_call\_chunks !== undefined && data.chunk.tool\_call\_chunks.length \> 0) {
      console.log(data.chunk.tool\_call\_chunks);
    }
  }
}
```

\[
  {
    name: 'search',
    args: '',
    id: 'call\_fNhlT6qSYWdJGPSYaVqLtTKO',
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: '{"',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: 'query',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: '":"',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: 'current',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: ' weather',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: ' today',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]
\[
  {
    name: undefined,
    args: '"}',
    id: undefined,
    index: 0,
    type: 'tool\_call\_chunk'
  }
\]


# How to call tools using ToolNode

This guide covers how to use LangGraph's prebuilt [`ToolNode`](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html) for tool calling.

`ToolNode` is a LangChain Runnable that takes graph state (with a list of messages) as input and outputs state update with the result of tool calls. It is designed to work well out-of-box with LangGraph's prebuilt ReAct agent, but can also work with any `StateGraph` as long as its state has a `messages` key with an appropriate reducer (see [`MessagesAnnotation`](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#messagesannotation)).

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/#setup)
--------------------------------------------------------------------------------

```
npm install @langchain/langgraph @langchain/anthropic @langchain/core zod
```

Set env vars:

```
process.env.ANTHROPIC\_API\_KEY \= 'your-anthropic-api-key';
```

Define tools[¶](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/#define-tools)
----------------------------------------------------------------------------------------------

```
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const getWeather \= tool((input) \=\> {
  if (\['sf', 'san francisco'\].includes(input.location.toLowerCase())) {
    return 'It\\'s 60 degrees and foggy.';
  } else {
    return 'It\\'s 90 degrees and sunny.';
  }
}, {
  name: 'get\_weather',
  description: 'Call to get the current weather.',
  schema: z.object({
    location: z.string().describe("Location to get the weather for."),
  })
})

const getCoolestCities \= tool(() \=\> {
  return 'nyc, sf';
}, {
  name: 'get\_coolest\_cities',
  description: 'Get a list of coolest cities',
  schema: z.object({
    noOp: z.string().optional().describe("No-op parameter."),
  })
})
```

```
import { ToolNode } from '@langchain/langgraph/prebuilt';

const tools \= \[getWeather, getCoolestCities\]
const toolNode \= new ToolNode(tools)
```


safeLog('Last message', { type: lastMessage._getType(), content: lastMessage.content });new SystemMessage({
  content: `...`,
  additional_kwargs: {}
})
`ToolNode` can also handle errors during tool execution. See our guide on handling errors in `ToolNode` [here](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling-errors/).

# How to force an agent to call a tool

In this example we will build a ReAct agent that **always** calls a certain tool first, before making any plans. In this example, we will create an agent with a search tool. However, at the start we will force the agent to call the search tool (and then let it do whatever it wants after). This is useful when you know you want to execute specific actions in your application but also want the flexibility of letting the LLM follow up on the user's query after going through that fixed sequence.

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#setup)
----------------------------------------------------------------------------------------------

First we need to install the packages required

```
yarn add @langchain/langgraph @langchain/openai @langchain/core
```

Next, we need to set API keys for OpenAI (the LLM we will use). Optionally, we can set API key for [LangSmith tracing](https://smith.langchain.com/), which will give us best-in-class observability.


```
// process.env.OPENAI\_API\_KEY = "sk\_...";

// Optional, add tracing in LangSmith
// process.env.LANGCHAIN\_API\_KEY = "ls\_\_...";
// process.env.LANGCHAIN\_CALLBACKS\_BACKGROUND = "true";
process.env.LANGCHAIN\_TRACING\_V2 \= "true";
process.env.LANGCHAIN\_PROJECT \= "Force Calling a Tool First: LangGraphJS";
```

Force Calling a Tool First: LangGraphJS

Set up the tools[¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#set-up-the-tools)
--------------------------------------------------------------------------------------------------------------------

We will first define the tools we want to use. For this simple example, we will use a built-in search tool via Tavily. However, it is really easy to create your own tools - see documentation [here](https://js.langchain.com/docs/modules/agents/tools/dynamic) on how to do that.


```
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const searchTool \= new DynamicStructuredTool({
  name: "search",
  description:
    "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
  schema: z.object({
    query: z.string().describe("The query to use in your search."),
  }),
  func: async ({}: { query: string }) \=\> {
    // This is a placeholder for the actual implementation
    return "Cold, with a low of 13 ℃";
  },
});

await searchTool.invoke({ query: "What's the weather like?" });

const tools \= \[searchTool\];
```


We can now wrap these tools in a `ToolNode`. This is a prebuilt node that takes in a LangChain chat model's generated tool call and calls that tool, returning the output.


```
import { ToolNode } from "@langchain/langgraph/prebuilt";

const toolNode \= new ToolNode(tools);
```


Set up the model[¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#set-up-the-model)
--------------------------------------------------------------------------------------------------------------------

Now we need to load the chat model we want to use.  
Importantly, this should satisfy two criteria:

1.  It should work with messages. We will represent all agent state in the form of messages, so it needs to be able to work well with them.
2.  It should work with OpenAI function calling. This means it should either be an OpenAI model or a model that exposes a similar interface.

Note: these model requirements are not requirements for using LangGraph - they are just requirements for this one example.

```
import { ChatOpenAI } from "@langchain/openai";

const model \= new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o",
});
```

After we've done this, we should make sure the model knows that it has these tools available to call. We can do this by converting the LangChain tools into the format for OpenAI function calling, and then bind them to the model class.

```
const boundModel \= model.bindTools(tools);
```


Define the agent state[¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#define-the-agent-state)
--------------------------------------------------------------------------------------------------------------------------------

The main type of graph in `langgraph` is the `StateGraph`. This graph is parameterized by a state object that it passes around to each node. Each node then returns operations to update that state.

For this example, the state we will track will just be a list of messages. We want each node to just add messages to that list. Therefore, we will define the agent state as an object with one key (`messages`) with the value specifying how to update the state.


```
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const AgentState \= Annotation.Root({
  messages: Annotation<BaseMessage\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
});
```


Define the nodes[¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#define-the-nodes)
--------------------------------------------------------------------------------------------------------------------

We now need to define a few different nodes in our graph. In `langgraph`, a node can be either a function or a [runnable](https://js.langchain.com/docs/expression_language/). There are two main nodes we need for this:

1.  The agent: responsible for deciding what (if any) actions to take.
2.  A function to invoke tools: if the agent decides to take an action, this node will then execute that action.

We will also need to define some edges. Some of these edges may be conditional. The reason they are conditional is that based on the output of a node, one of several paths may be taken. The path that is taken is not known until that node is run (the LLM decides).

1.  Conditional Edge: after the agent is called, we should either: a. If the agent said to take an action, then the function to invoke tools should be called  
    b. If the agent said that it was finished, then it should finish
2.  Normal Edge: after the tools are invoked, it should always go back to the agent to decide what to do next

Let's define the nodes, as well as a function to decide how what conditional edge to take.

```
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { concat } from "@langchain/core/utils/stream";

// Define logic that will be used to determine which conditional edge to go down
const shouldContinue \= (state: typeof AgentState.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\] as AIMessage;
  // If there is no function call, then we finish
  if (!lastMessage.tool\_calls || lastMessage.tool\_calls.length \=== 0) {
    return "end";
  }
  // Otherwise if there is, we continue
  return "continue";
};

// Define the function that calls the model
const callModel \= async (
  state: typeof AgentState.State,
  config?: RunnableConfig,
) \=\> {
  const { messages } \= state;
  let response: AIMessageChunk | undefined;
  for await (const message of await boundModel.stream(messages, config)) {
    if (!response) {
      response \= message;
    } else {
      response \= concat(response, message);
    }
  }
  // We return an object, because this will get added to the existing list
  return {
    messages: response ? \[response as AIMessage\] : \[\],
  };
};
```


**MODIFICATION**

Here we create a node that returns an AIMessage with a tool call - we will use this at the start to force it call a tool


```
// This is the new first - the first call of the model we want to explicitly hard-code some action
const firstModel \= async (state: typeof AgentState.State) \=\> {
  const humanInput \= state.messages\[state.messages.length \- 1\].content || "";
  return {
    messages: \[
      new AIMessage({
        content: "",
        tool\_calls: \[
          {
            name: "search",
            args: {
              query: humanInput,
            },
            id: "tool\_abcd123",
          },
        \],
      }),
    \],
  };
};
```

Define the graph[¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#define-the-graph)
--------------------------------------------------------------------------------------------------------------------

We can now put it all together and define the graph!

**MODIFICATION**

We will define a `firstModel` node which we will set as the entrypoint.

```
import { END, START, StateGraph } from "@langchain/langgraph";

// Define a new graph
const workflow \= new StateGraph(AgentState)
  // Define the new entrypoint
  .addNode("first\_agent", firstModel)
  // Define the two nodes we will cycle between
  .addNode("agent", callModel)
  .addNode("action", toolNode)
  // Set the entrypoint as \`first\_agent\`
  // by creating an edge from the virtual \_\_start\_\_ node to \`first\_agent\`
  .addEdge(START, "first\_agent")
  // We now add a conditional edge
  .addConditionalEdges(
    // First, we define the start node. We use \`agent\`.
    // This means these are the edges taken after the \`agent\` node is called.
    "agent",
    // Next, we pass in the function that will determine which node is called next.
    shouldContinue,
    // Finally we pass in a mapping.
    // The keys are strings, and the values are other nodes.
    // END is a special node marking that the graph should finish.
    // What will happen is we will call \`should\_continue\`, and then the output of that
    // will be matched against the keys in this mapping.
    // Based on which one it matches, that node will then be called.
    {
      // If \`tools\`, then we call the tool node.
      continue: "action",
      // Otherwise we finish.
      end: END,
    },
  )
  // We now add a normal edge from \`tools\` to \`agent\`.
  // This means that after \`tools\` is called, \`agent\` node is called next.
  .addEdge("action", "agent")
  // After we call the first agent, we know we want to go to action
  .addEdge("first\_agent", "action");

// Finally, we compile it!
// This compiles it into a LangChain Runnable,
// meaning you can use it as you would any other runnable
const app \= workflow.compile();
```

Use it![¶](https://langchain-ai.github.io/langgraphjs/how-tos/force-calling-a-tool-first/#use-it)
-------------------------------------------------------------------------------------------------

We can now use it! This now exposes the [same interface](https://js.langchain.com/docs/expression_language/) as all other LangChain runnables.


```
import { HumanMessage } from "@langchain/core/messages";

const inputs \= {
  messages: \[new HumanMessage("what is the weather in sf")\],
};

for await (const output of await app.stream(inputs)) {
  console.log(output);
  console.log("-----\\n");
}
```

{
  first\_agent: {
    messages: \[
      AIMessage {
        "content": "",
        "additional\_kwargs": {},
        "response\_metadata": {},
        "tool\_calls": \[
          {
            "name": "search",
            "args": {
              "query": "what is the weather in sf"
            },
            "id": "tool\_abcd123"
          }
        \],
        "invalid\_tool\_calls": \[\]
      }
    \]
  }
}
-----

{
  action: {
    messages: \[
      ToolMessage {
        "content": "Cold, with a low of 13 ℃",
        "name": "search",
        "additional\_kwargs": {},
        "response\_metadata": {},
        "tool\_call\_id": "tool\_abcd123"
      }
    \]
  }
}
-----

{
  agent: {
    messages: \[
      AIMessageChunk {
        "id": "chatcmpl-9y562g16z0MUNBJcS6nKMsDuFMRsS",
        "content": "The current weather in San Francisco is cold, with a low of 13°C.",
        "additional\_kwargs": {},
        "response\_metadata": {
          "prompt": 0,
          "completion": 0,
          "finish\_reason": "stop",
          "system\_fingerprint": "fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27fp\_3aa7262c27"
        },
        "tool\_calls": \[\],
        "tool\_call\_chunks": \[\],
        "invalid\_tool\_calls": \[\],
        "usage\_metadata": {
          "input\_tokens": 104,
          "output\_tokens": 18,
          "total\_tokens": 122
        }
      }
    \]
  }
}
-----


# How to handle tool calling errors

LLMs aren't perfect at calling tools. The model may try to call a tool that doesn't exist or fail to return arguments that match the requested schema. Strategies like keeping schemas simple, reducing the number of tools you pass at once, and having good names and descriptions can help mitigate this risk, but aren't foolproof.

This guide covers some ways to build error handling into your graphs to mitigate these failure modes.

Compatibility

This guide requires `@langchain/langgraph>=0.0.28`, `@langchain/anthropic>=0.2.6`, and `@langchain/core>=0.2.17`. For help upgrading, see [this guide](https://langchain-ai.github.io/langgraphjs/how-tos/manage-ecosystem-dependencies/).

Using the prebuilt `ToolNode`[¶](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling-errors/#using-the-prebuilt-toolnode)
-------------------------------------------------------------------------------------------------------------------------------------

To start, define a mock weather tool that has some hidden restrictions on input queries. The intent here is to simulate a real-world case where a model fails to call a tool correctly:

```
$ npm install @langchain/langgraph @langchain/anthropic @langchain/core
```

```
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const getWeather \= tool(async ({ location }) \=\> {
  if (location \=== "SAN FRANCISCO") {
    return "It's 60 degrees and foggy";
  } else if (location.toLowerCase() \=== "san francisco") {
    throw new Error("Input queries must be all capitals");
  } else {
    throw new Error("Invalid input.");
  }
}, {
  name: "get\_weather",
  description: "Call to get the current weather",
  schema: z.object({
    location: z.string(),
  }),
});
```


Next, set up a graph implementation of the [ReAct agent](https://langchain-ai.github.io/langgraphjs/concepts/). This agent takes some query as input, then repeatedly call tools until it has enough information to resolve the query. We'll use the prebuilt [`ToolNode`](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph_prebuilt.ToolNode.html) to execute called tools, and a small, fast model powered by Anthropic:


```
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseMessage, isAIMessage } from "@langchain/core/messages";

const toolNode \= new ToolNode(\[getWeather\]);

const modelWithTools \= new ChatAnthropic({
  model: "claude-3-haiku-20240307",
  temperature: 0,
}).bindTools(\[getWeather\]);

const shouldContinue \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\];
  if (isAIMessage(lastMessage) && lastMessage.tool\_calls?.length) {
    return "tools";
  }
  return "\_\_end\_\_";
}

const callModel \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const response \= await modelWithTools.invoke(messages);
  return { messages: \[response\] };
}

const app \= new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("\_\_start\_\_", "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue, {
    // Explicitly list possible destinations so that
    // we can automatically draw the graph below.
    tools: "tools",
    \_\_end\_\_: "\_\_end\_\_",
  })
  .compile();
```

```
import \* as tslab from "tslab";

const graph \= app.getGraph();
const image \= await graph.drawMermaidPng();
const arrayBuffer \= await image.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer));
```

![Image 5: No description has been provided for this image](blob:https://langchain-ai.github.io/601be90163f8b32f92952dfa4d1d15a5)

When you try to call the tool, you can see that the model calls the tool with a bad input, causing the tool to throw an error. The prebuilt `ToolNode` that executes the tool has some built-in error handling that captures the error and passes it back to the model so that it can try again:


```
const response \= await app.invoke({
  messages: \[
    { role: "user", content: "what is the weather in san francisco?"},
  \]
});

for (const message of response.messages) {
  // Anthropic returns tool calls in content as well as in \`AIMessage.tool\_calls\`
  const content \= JSON.stringify(message.content, null, 2);
  console.log(\`${message.\_getType().toUpperCase()}: ${content}\`);
}
```


HUMAN: "what is the weather in san francisco?"
AI: \[
  {
    "type": "text",
    "text": "Okay, let's check the weather in San Francisco:"
  },
  {
    "type": "tool\_use",
    "id": "toolu\_015dywEMjSJsjkgP91VDbm52",
    "name": "get\_weather",
    "input": {
      "location": "San Francisco"
    }
  }
\]
TOOL: "Error: Input queries must be all capitals\\n Please fix your mistakes."
AI: \[
  {
    "type": "text",
    "text": "Apologies, let me try that again with the location in all capital letters:"
  },
  {
    "type": "tool\_use",
    "id": "toolu\_01Qw6t7p9UGk8aHQh7qtLJZT",
    "name": "get\_weather",
    "input": {
      "location": "SAN FRANCISCO"
    }
  }
\]
TOOL: "It's 60 degrees and foggy"
AI: "The weather in San Francisco is 60 degrees and foggy."

Custom strategies[¶](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling-errors/#custom-strategies)
---------------------------------------------------------------------------------------------------------------

This is a fine default in many cases, but there are cases where custom fallbacks may be better.

For example, the below tool requires as input a list of elements of a specific length - tricky for a small model! We'll also intentionally avoid pluralizing `topic` to trick the model into thinking it should pass a string:


```
import { StringOutputParser } from "@langchain/core/output\_parsers";

const haikuRequestSchema \= z.object({
  topic: z.array(z.string()).length(3),
});

const masterHaikuGenerator \= tool(async ({ topic }) \=\> {
  const model \= new ChatAnthropic({
    model: "claude-3-haiku-20240307",
    temperature: 0,
  });
  const chain \= model.pipe(new StringOutputParser());
  const topics \= topic.join(", ");
  const haiku \= await chain.invoke(\`Write a haiku about ${topics}\`);
  return haiku;
}, {
  name: "master\_haiku\_generator",
  description: "Generates a haiku based on the provided topics.",
  schema: haikuRequestSchema,
});

const customStrategyToolNode \= new ToolNode(\[masterHaikuGenerator\]);

const customStrategyModel \= new ChatAnthropic({
  model: "claude-3-haiku-20240307",
  temperature: 0,
});
const customStrategyModelWithTools \= customStrategyModel.bindTools(\[masterHaikuGenerator\]);

const customStrategyShouldContinue \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\];
  if (isAIMessage(lastMessage) && lastMessage.tool\_calls?.length) {
    return "tools";
  }
  return "\_\_end\_\_";
}

const customStrategyCallModel \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const response \= await customStrategyModelWithTools.invoke(messages);
  return { messages: \[response\] };
}

const customStrategyApp \= new StateGraph(MessagesAnnotation)
  .addNode("tools", customStrategyToolNode)
  .addNode("agent", customStrategyCallModel)
  .addEdge("\_\_start\_\_", "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", customStrategyShouldContinue, {
    // Explicitly list possible destinations so that
    // we can automatically draw the graph below.
    tools: "tools",
    \_\_end\_\_: "\_\_end\_\_",
  })
  .compile();

const response2 \= await customStrategyApp.invoke(
  {
    messages: \[{ role: "user", content: "Write me an incredible haiku about water." }\],
  },
  { recursionLimit: 10 }
);

for (const message of response2.messages) {
  // Anthropic returns tool calls in content as well as in \`AIMessage.tool\_calls\`
  const content \= JSON.stringify(message.content, null, 2);
  console.log(\`${message.\_getType().toUpperCase()}: ${content}\`);
}
```



HUMAN: "Write me an incredible haiku about water."
AI: \[
  {
    "type": "text",
    "text": "Okay, let's generate a haiku about water using the master haiku generator tool:"
  },
  {
    "type": "tool\_use",
    "id": "toolu\_01CMvVu3MhPeCk5X7F8GBv8f",
    "name": "master\_haiku\_generator",
    "input": {
      "topic": \[
        "water"
      \]
    }
  }
\]
TOOL: "Error: Received tool input did not match expected schema\\n Please fix your mistakes."
AI: \[
  {
    "type": "text",
    "text": "Oops, looks like I need to provide 3 topics for the haiku generator. Let me try again with 3 water-related topics:"
  },
  {
    "type": "tool\_use",
    "id": "toolu\_0158Nz2scGSWvYor4vmJbSDZ",
    "name": "master\_haiku\_generator",
    "input": {
      "topic": \[
        "ocean",
        "waves",
        "rain"
      \]
    }
  }
\]
TOOL: "Here is a haiku about the ocean, waves, and rain:\\n\\nWaves crash on the shore,\\nRhythmic dance of water's song,\\nRain falls from the sky."
AI: "The haiku generator has produced a beautiful and evocative poem about the different aspects of water - the ocean, waves, and rain. I hope you enjoy this creative take on a water-themed haiku!"

We can see that the model takes two attempts.

A better strategy might be to trim the failed attempt to reduce distraction, then fall back to a more advanced model. Here's an example - note the custom-built tool calling node instead of the prebuilt `ToolNode`:


```
import { AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";

const haikuRequestSchema2 \= z.object({
  topic: z.array(z.string()).length(3),
});

const masterHaikuGenerator2 \= tool(async ({ topic }) \=\> {
  const model \= new ChatAnthropic({
    model: "claude-3-haiku-20240307",
    temperature: 0,
  });
  const chain \= model.pipe(new StringOutputParser());
  const topics \= topic.join(", ");
  const haiku \= await chain.invoke(\`Write a haiku about ${topics}\`);
  return haiku;
}, {
  name: "master\_haiku\_generator",
  description: "Generates a haiku based on the provided topics.",
  schema: haikuRequestSchema2,
});

const callTool2 \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const toolsByName \= { master\_haiku\_generator: masterHaikuGenerator };
  const lastMessage \= messages\[messages.length \- 1\] as AIMessage;
  const outputMessages: ToolMessage\[\] \= \[\];
  for (const toolCall of lastMessage.tool\_calls) {
    try {
      const toolResult \= await toolsByName\[toolCall.name\].invoke(toolCall);
      outputMessages.push(toolResult);
    } catch (error: any) {
      // Return the error if the tool call fails
      outputMessages.push(
        new ToolMessage({
          content: error.message,
          name: toolCall.name,
          tool\_call\_id: toolCall.id!,
          additional\_kwargs: { error }
        })
      );
    }
  }
  return { messages: outputMessages };
};

const model \= new ChatAnthropic({
  model: "claude-3-haiku-20240307",
  temperature: 0,
});
const modelWithTools2 \= model.bindTools(\[masterHaikuGenerator2\]);

const betterModel \= new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0,
});
const betterModelWithTools \= betterModel.bindTools(\[masterHaikuGenerator2\]);

const shouldContinue2 \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\];
  if (isAIMessage(lastMessage) && lastMessage.tool\_calls?.length) {
    return "tools";
  }
  return "\_\_end\_\_";
}

const shouldFallback \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const failedToolMessages \= messages.find((message) \=\> {
    return message.\_getType() \=== "tool" && message.additional\_kwargs.error !== undefined;
  });
  if (failedToolMessages) {
    return "remove\_failed\_tool\_call\_attempt";
  }
  return "agent";
}

const callModel2 \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const response \= await modelWithTools2.invoke(messages);
  return { messages: \[response\] };
}

const removeFailedToolCallAttempt \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  // Remove all messages from the most recent
  // instance of AIMessage onwards.
  const lastAIMessageIndex \= messages
    .map((msg, index) \=\> ({ msg, index }))
    .reverse()
    .findIndex(({ msg }) \=\> isAIMessage(msg));
  const messagesToRemove \= messages.slice(lastAIMessageIndex);
  return { messages: messagesToRemove.map(m \=\> new RemoveMessage({ id: m.id })) };
}

const callFallbackModel \= async (state: typeof MessagesAnnotation.State) \=\> {
  const { messages } \= state;
  const response \= await betterModelWithTools.invoke(messages);
  return { messages: \[response\] };
}

const app2 \= new StateGraph(MessagesAnnotation)
  .addNode("tools", callTool2)
  .addNode("agent", callModel2)
  .addNode("remove\_failed\_tool\_call\_attempt", removeFailedToolCallAttempt)
  .addNode("fallback\_agent", callFallbackModel)
  .addEdge("\_\_start\_\_", "agent")
  .addConditionalEdges("agent", shouldContinue2, {
    // Explicitly list possible destinations so that
    // we can automatically draw the graph below.
    tools: "tools",
    \_\_end\_\_: "\_\_end\_\_",
  })
  .addConditionalEdges("tools", shouldFallback, {
    remove\_failed\_tool\_call\_attempt: "remove\_failed\_tool\_call\_attempt",
    agent: "agent",
  })
  .addEdge("remove\_failed\_tool\_call\_attempt", "fallback\_agent")
  .addEdge("fallback\_agent", "tools")
  .compile();
```

The `tools` node will now return `ToolMessage`s with an `error` field in `additional_kwargs` if a tool call fails. If that happens, it will go to another node that removes the failed tool messages, and has a better model retry the tool call generation. We also add a trimming step via returning the special message modifier `RemoveMessage` to remove previous messages from the state.

The diagram below shows this visually:


```
import \* as tslab from "tslab";

const graph2 \= app2.getGraph();
const image2 \= await graph2.drawMermaidPng();
const arrayBuffer2 \= await image2.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer2));
```


![Image 6: No description has been provided for this image](blob:https://langchain-ai.github.io/584772cd669c4ac749fc3a63e7bc09d4)

Let's try it out. To emphasize the removal steps, let's `stream` the responses from the model so that we can see each executed node:

```
const stream \= await app2.stream(
  { messages: \[{ role: "user", content: "Write me an incredible haiku about water." }\] },
  { recursionLimit: 10 },
)

for await (const chunk of stream) {
  console.log(chunk);
}
```

{
  agent: {
    messages: \[
      AIMessage {
        "id": "msg\_01HqvhPuubXqerWgYRNFqPrd",
        "content": \[
          {
            "type": "text",
            "text": "Okay, let's generate a haiku about water using the master haiku generator tool:"
          },
          {
            "type": "tool\_use",
            "id": "toolu\_01QFmyc5vhQBFfzF7hCGTRc1",
            "name": "master\_haiku\_generator",
            "input": {
              "topic": "\[Array\]"
            }
          }
        \],
        "additional\_kwargs": {
          "id": "msg\_01HqvhPuubXqerWgYRNFqPrd",
          "type": "message",
          "role": "assistant",
          "model": "claude-3-haiku-20240307",
          "stop\_reason": "tool\_use",
          "stop\_sequence": null,
          "usage": {
            "input\_tokens": 392,
            "output\_tokens": 77
          }
        },
        "response\_metadata": {
          "id": "msg\_01HqvhPuubXqerWgYRNFqPrd",
          "model": "claude-3-haiku-20240307",
          "stop\_reason": "tool\_use",
          "stop\_sequence": null,
          "usage": {
            "input\_tokens": 392,
            "output\_tokens": 77
          },
          "type": "message",
          "role": "assistant"
        },
        "tool\_calls": \[
          {
            "name": "master\_haiku\_generator",
            "args": {
              "topic": "\[Array\]"
            },
            "id": "toolu\_01QFmyc5vhQBFfzF7hCGTRc1",
            "type": "tool\_call"
          }
        \],
        "invalid\_tool\_calls": \[\],
        "usage\_metadata": {
          "input\_tokens": 392,
          "output\_tokens": 77,
          "total\_tokens": 469
        }
      }
    \]
  }
}
{
  tools: {
    messages: \[
      ToolMessage {
        "id": "502c7399-4d95-4afd-8a86-ece864d2bc7f",
        "content": "Received tool input did not match expected schema",
        "name": "master\_haiku\_generator",
        "additional\_kwargs": {
          "error": {
            "output": "{\\"topic\\":\[\\"water\\"\]}"
          }
        },
        "response\_metadata": {},
        "tool\_call\_id": "toolu\_01QFmyc5vhQBFfzF7hCGTRc1"
      }
    \]
  }
}
{
  remove\_failed\_tool\_call\_attempt: {
    messages: \[
      BaseMessage {
        "id": "msg\_01HqvhPuubXqerWgYRNFqPrd",
        "content": "",
        "additional\_kwargs": {},
        "response\_metadata": {}
      },
      BaseMessage {
        "id": "502c7399-4d95-4afd-8a86-ece864d2bc7f",
        "content": "",
        "additional\_kwargs": {},
        "response\_metadata": {}
      }
    \]
  }
}
{
  fallback\_agent: {
    messages: \[
      AIMessage {
        "id": "msg\_01EQSawL2oxNhph9be99k7Yp",
        "content": \[
          {
            "type": "text",
            "text": "Certainly! I'd be happy to help you create an incredible haiku about water. To do this, we'll use the master\_haiku\_generator function, which requires three topics as input. Since you've specified water as the main theme, I'll add two related concepts to create a more vivid and interesting haiku. Let's use \\"water,\\" \\"flow,\\" and \\"reflection\\" as our three topics.\\n\\nHere's the function call to generate your haiku:"
          },
          {
            "type": "tool\_use",
            "id": "toolu\_017hrp13SsgfdJTdhkJDMaQy",
            "name": "master\_haiku\_generator",
            "input": {
              "topic": "\[Array\]"
            }
          }
        \],
        "additional\_kwargs": {
          "id": "msg\_01EQSawL2oxNhph9be99k7Yp",
          "type": "message",
          "role": "assistant",
          "model": "claude-3-5-sonnet-20240620",
          "stop\_reason": "tool\_use",
          "stop\_sequence": null,
          "usage": {
            "input\_tokens": 422,
            "output\_tokens": 162
          }
        },
        "response\_metadata": {
          "id": "msg\_01EQSawL2oxNhph9be99k7Yp",
          "model": "claude-3-5-sonnet-20240620",
          "stop\_reason": "tool\_use",
          "stop\_sequence": null,
          "usage": {
            "input\_tokens": 422,
            "output\_tokens": 162
          },
          "type": "message",
          "role": "assistant"
        },
        "tool\_calls": \[
          {
            "name": "master\_haiku\_generator",
            "args": {
              "topic": "\[Array\]"
            },
            "id": "toolu\_017hrp13SsgfdJTdhkJDMaQy",
            "type": "tool\_call"
          }
        \],
        "invalid\_tool\_calls": \[\],
        "usage\_metadata": {
          "input\_tokens": 422,
          "output\_tokens": 162,
          "total\_tokens": 584
        }
      }
    \]
  }
}
{
  tools: {
    messages: \[
      ToolMessage {
        "id": "3d24d291-7501-4a65-9286-10dc47239b5b",
        "content": "Here is a haiku about water, flow, and reflection:\\n\\nRippling waters flow,\\nMirroring the sky above,\\nTranquil reflection.",
        "name": "master\_haiku\_generator",
        "additional\_kwargs": {},
        "response\_metadata": {},
        "tool\_call\_id": "toolu\_017hrp13SsgfdJTdhkJDMaQy"
      }
    \]
  }
}
{
  agent: {
    messages: \[
      AIMessage {
        "id": "msg\_01Jy7Vw8DN77sjVWcB4TcJR6",
        "content": "I hope you enjoy this haiku about the beauty and serenity of water. Please let me know if you would like me to generate another one.",
        "additional\_kwargs": {
          "id": "msg\_01Jy7Vw8DN77sjVWcB4TcJR6",
          "type": "message",
          "role": "assistant",
          "model": "claude-3-haiku-20240307",
          "stop\_reason": "end\_turn",
          "stop\_sequence": null,
          "usage": {
            "input\_tokens": 601,
            "output\_tokens": 35
          }
        },
        "response\_metadata": {
          "id": "msg\_01Jy7Vw8DN77sjVWcB4TcJR6",
          "model": "claude-3-haiku-20240307",
          "stop\_reason": "end\_turn",
          "stop\_sequence": null,
          "usage": {
            "input\_tokens": 601,
            "output\_tokens": 35
          },
          "type": "message",
          "role": "assistant"
        },
        "tool\_calls": \[\],
        "invalid\_tool\_calls": \[\],
        "usage\_metadata": {
          "input\_tokens": 601,
          "output\_tokens": 35,
          "total\_tokens": 636
        }
      }
    \]
  }
}

You can see that you get a cleaner response - the more powerful model gets it right on the first try, and the smaller model's failure gets wiped from the graph state. This shorter message history also avoid overpopulating the graph state with attempts.

You can also inspect this [LangSmith trace](https://smith.langchain.com/public/c94f95d0-97fc-4d4d-a59a-b5161c2f4a90/r), which shows the failed initial call to the smaller model.

Next steps[¶](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling-errors/#next-steps)
-------------------------------------------------------------------------------------------------

You've now seen how to implement some strategies to handle tool calling errors.


# How to pass runtime values to tools

This guide shows how to define tools that depend on dynamically defined variables. These values are provided by your program, not by the LLM.

Tools can access the [config.configurable](https://langchain-ai.github.io/langgraphjs/reference/interfaces/langgraph.LangGraphRunnableConfig.html) field for values like user IDs that are known when a graph is initially executed, as well as managed values from the [store](https://langchain-ai.github.io/langgraphjs/reference/classes/checkpoint.BaseStore.html) for persistence across threads.

However, it can be convenient to access intermediate runtime values which are not known ahead of time, but are progressively generated as a graph executes, such as the current graph state. This guide will cover two techniques for this: context variables and closures.

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/pass-run-time-values-to-tools/#setup)
-------------------------------------------------------------------------------------------------

Install the following to run this guide:

```
npm install @langchain/langgraph @langchain/openai @langchain/core
```

Next, configure your environment to connect to your model provider.

```
export OPENAI\_API\_KEY\=your-api-key
```

Optionally, set your API key for [LangSmith tracing](https://smith.langchain.com/), which will give us best-in-class observability.

```
export LANGCHAIN\_TRACING\_V2\="true"
export LANGCHAIN\_CALLBACKS\_BACKGROUND\="true"
export LANGCHAIN\_API\_KEY\=your-api-key
```

Context variables[¶](https://langchain-ai.github.io/langgraphjs/how-tos/pass-run-time-values-to-tools/#context-variables)
-------------------------------------------------------------------------------------------------------------------------

[Context variables](https://js.langchain.com/docs/how_to/tool_runtime#using-context-variables) are a powerful feature that allows you to set values at one level of your application, then access them within any child runnables (such as tools) nested within.

They are convenient in that you don’t need to have a direct reference to the declared variable to access it from a child, just a string with the variable name.

Compatibility

This functionality was added in `@langchain/core>=0.3.10`. If you are using the LangSmith SDK separately in your project, we also recommend upgrading to `langsmith>=0.1.65`. For help upgrading, see [this guide](https://langchain-ai.github.io/langgraphjs/how-tos/manage-ecosystem-dependencies/).

It also requires [`async_hooks`](https://nodejs.org/api/async_hooks.html) support, which is supported in many popular JavaScript environments (such as Node.js, Deno, and Cloudflare Workers), but not all of them (mainly web browsers).

Let's define a tool that an LLM can use to update pet preferences for a user. The tool will retrieve the current state of the graph from the current context.

### Define the agent state[¶](https://langchain-ai.github.io/langgraphjs/how-tos/pass-run-time-values-to-tools/#define-the-agent-state)

For this example, the state we will track will just be a list of messages:


```
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const StateAnnotation \= Annotation.Root({
  messages: Annotation<BaseMessage\[\]\>({
    reducer: (x, y) \=\> x.concat(y),
  }),
});
```

Now, declare a tool as shown below. The tool receives values in three different ways:

1.  It will receive a generated list of `pets` from the LLM in its `input`.
2.  It will pull a `userId` populated from the initial graph invocation.
3.  It will get the current state of the graph at runtime from a context variable.

It will then use LangGraph's [cross-thread persistence](https://langchain-ai.github.io/langgraphjs/how-tos/cross-thread-persistence/) to save preferences:


```
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getContextVariable } from "@langchain/core/context";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const updateFavoritePets \= tool(async (input, config: LangGraphRunnableConfig) \=\> {
  // Some arguments are populated by the LLM; these are included in the schema below
  const { pets } \= input;
  // Fetch a context variable named "currentState".
  // We must set this variable explicitly in each node that calls this tool.
  const currentState \= getContextVariable("currentState");
  // Other information (such as a UserID) are most easily provided via the config
  // This is set when when invoking or streaming the graph
  const userId \= config.configurable?.userId;
  // LangGraph's managed key-value store is also accessible from the config
  const store \= config.store;
  await store.put(\[userId, "pets"\], "names", pets);
  // Store the initial input message from the user as a note.
  // Using the same key will override previous values - you could
  // use something different if you wanted to store many interactions.
  await store.put(\[userId, "pets"\], "context", currentState.messages\[0\].content);

  return "update\_favorite\_pets called.";
},
{
  // The LLM "sees" the following schema:
  name: "update\_favorite\_pets",
  description: "add to the list of favorite pets.",
  schema: z.object({
    pets: z.array(z.string()),
  }),
});
```


If we look at the tool call schema, which is what is passed to the model for tool-calling, only `pets` is being passed:


```
import { zodToJsonSchema } from "zod-to-json-schema";

console.log(zodToJsonSchema(updateFavoritePets.schema));
```

{
  type: 'object',
  properties: { pets: { type: 'array', items: \[Object\] } },
  required: \[ 'pets' \],
  additionalProperties: false,
  '$schema': 'http://json-schema.org/draft-07/schema#'
}

Let's also declare another tool so that our agent can retrieve previously set preferences:


```
const getFavoritePets \= tool(
  async (\_, config: LangGraphRunnableConfig) \=\> {
    const userId \= config.configurable?.userId;
    // LangGraph's managed key-value store is also accessible via the config
    const store \= config.store;
    const petNames \= await store.get(\[userId, "pets"\], "names");
    const context \= await store.get(\[userId, "pets"\], "context");
    return JSON.stringify({
      pets: petNames.value,
      context: context.value,
    });
  },
  {
    // The LLM "sees" the following schema:
    name: "get\_favorite\_pets",
    description: "retrieve the list of favorite pets for the given user.",
    schema: z.object({}),
  }
);
```

Define the nodes[¶](https://langchain-ai.github.io/langgraphjs/how-tos/pass-run-time-values-to-tools/#define-the-nodes)
-----------------------------------------------------------------------------------------------------------------------

We now need to define a few different nodes in our graph.

1.  The agent: responsible for deciding what (if any) actions to take.
2.  A function to invoke tools: if the agent decides to take an action, this node will then execute that action. It will also set the current state as a context variable.

We will also need to define some edges.

1.  After the agent is called, we should either invoke the tool node or finish.
2.  After the tool node have been invoked, it should always go back to the agent to decide what to do next


```
import {
  END,
  START,
  StateGraph,
  MemorySaver,
  InMemoryStore,
} from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

import { setContextVariable } from "@langchain/core/context";

const model \= new ChatOpenAI({ model: "gpt-4o" });

const tools \= \[getFavoritePets, updateFavoritePets\];

const routeMessage \= (state: typeof StateAnnotation.State) \=\> {
  const { messages } \= state;
  const lastMessage \= messages\[messages.length \- 1\] as AIMessage;
  // If no tools are called, we can finish (respond to the user)
  if (!lastMessage?.tool\_calls?.length) {
    return END;
  }
  // Otherwise if there is, we continue and call the tools
  return "tools";
};

const callModel \= async (state: typeof StateAnnotation.State) \=\> {
  const { messages } \= state;
  const modelWithTools \= model.bindTools(tools);
  const responseMessage \= await modelWithTools.invoke(\[
    {
      role: "system",
      content: "You are a personal assistant. Store any preferences the user tells you about."
    },
    ...messages
  \]);
  return { messages: \[responseMessage\] };
};

const toolNodeWithGraphState \= async (state: typeof StateAnnotation.State) \=\> {
  // We set a context variable before invoking the tool node and running our tool.
  setContextVariable("currentState", state);
  const toolNodeWithConfig \= new ToolNode(tools);
  return toolNodeWithConfig.invoke(state);
};

const workflow \= new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNodeWithGraphState)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routeMessage)
  .addEdge("tools", "agent");

const memory \= new MemorySaver();
const store \= new InMemoryStore();

const graph \= workflow.compile({ checkpointer: memory, store: store });
```

```
import \* as tslab from "tslab";

const graphViz \= graph.getGraph();
const image \= await graphViz.drawMermaidPng();
const arrayBuffer \= await image.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer));
```

![Image 5: No description has been provided for this image](blob:https://langchain-ai.github.io/762c13ef00ea7c2641eb8fe70122ec93)

Use it![¶](https://langchain-ai.github.io/langgraphjs/how-tos/pass-run-time-values-to-tools/#use-it)
----------------------------------------------------------------------------------------------------

Let's use our graph now!


```
let inputs \= { messages: \[{ role: "user", content: "My favorite pet is a terrier. I saw a cute one on Twitter." }\] };
let config \= {
  configurable: {
    thread\_id: "1",
    userId: "a-user"
  }
};
let stream \= await graph.stream(inputs, config);

for await (const chunk of stream) {
  for (const \[node, values\] of Object.entries(chunk)) {
    console.log(\`Output from node: ${node}\`);
    console.log("---");
    console.log(values);
    console.log("\\n====\\n");
  }
}
```


Output from node: agent
---
{
  messages: \[
    AIMessage {
      "id": "chatcmpl-AHcDfVrNHLi0DVBtW84UapOoeAP1t",
      "content": "",
      "additional\_kwargs": {
        "tool\_calls": \[
          {
            "id": "call\_L3pw6ipwtBxdudekgCymgcBt",
            "type": "function",
            "function": "\[Object\]"
          }
        \]
      },
      "response\_metadata": {
        "tokenUsage": {
          "completionTokens": 19,
          "promptTokens": 102,
          "totalTokens": 121
        },
        "finish\_reason": "tool\_calls",
        "system\_fingerprint": "fp\_6b68a8204b"
      },
      "tool\_calls": \[
        {
          "name": "update\_favorite\_pets",
          "args": {
            "pets": "\[Array\]"
          },
          "type": "tool\_call",
          "id": "call\_L3pw6ipwtBxdudekgCymgcBt"
        }
      \],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 102,
        "output\_tokens": 19,
        "total\_tokens": 121
      }
    }
  \]
}

====

Output from node: tools
---
{
  messages: \[
    ToolMessage {
      "content": "update\_favorite\_pets called.",
      "name": "update\_favorite\_pets",
      "additional\_kwargs": {},
      "response\_metadata": {},
      "tool\_call\_id": "call\_L3pw6ipwtBxdudekgCymgcBt"
    }
  \]
}

====

Output from node: agent
---
{
  messages: \[
    AIMessage {
      "id": "chatcmpl-AHcDfhVBJjGpk3Bdxw1tDQCZxqci5",
      "content": "I've added \\"terrier\\" to your list of favorite pets! If there's anything else you would like to share or update, feel free to let me know.",
      "additional\_kwargs": {},
      "response\_metadata": {
        "tokenUsage": {
          "completionTokens": 33,
          "promptTokens": 139,
          "totalTokens": 172
        },
        "finish\_reason": "stop",
        "system\_fingerprint": "fp\_6b68a8204b"
      },
      "tool\_calls": \[\],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 139,
        "output\_tokens": 33,
        "total\_tokens": 172
      }
    }
  \]
}

====

Now verify it can properly fetch the stored preferences and cite where it got the information from:

```
inputs \= { messages: \[{ role: "user", content: "What're my favorite pets and what did I say when I told you about them?" }\] };
config \= {
  configurable: {
    thread\_id: "2", // New thread ID, so the conversation history isn't present.
    userId: "a-user"
  }
};

stream \= await graph.stream(inputs, {
  ...config
});

for await (
  const chunk of stream
) {
  for (const \[node, values\] of Object.entries(chunk)) {
    console.log(\`Output from node: ${node}\`);
    console.log("---");
    console.log(values);
    console.log("\\n====\\n");
  }
}
```


Output from node: agent
---
{
  messages: \[
    AIMessage {
      "id": "chatcmpl-AHcDgeIcrobhGEwsuuH0yI4YoEKbo",
      "content": "",
      "additional\_kwargs": {
        "tool\_calls": \[
          {
            "id": "call\_1vtxWaH6Xhg8uwWo1M2Y5gOg",
            "type": "function",
            "function": "\[Object\]"
          }
        \]
      },
      "response\_metadata": {
        "tokenUsage": {
          "completionTokens": 13,
          "promptTokens": 103,
          "totalTokens": 116
        },
        "finish\_reason": "tool\_calls",
        "system\_fingerprint": "fp\_6b68a8204b"
      },
      "tool\_calls": \[
        {
          "name": "get\_favorite\_pets",
          "args": {},
          "type": "tool\_call",
          "id": "call\_1vtxWaH6Xhg8uwWo1M2Y5gOg"
        }
      \],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 103,
        "output\_tokens": 13,
        "total\_tokens": 116
      }
    }
  \]
}

====

Output from node: tools
---
{
  messages: \[
    ToolMessage {
      "content": "{\\"pets\\":\[\\"terrier\\"\],\\"context\\":\\"My favorite pet is a terrier. I saw a cute one on Twitter.\\"}",
      "name": "get\_favorite\_pets",
      "additional\_kwargs": {},
      "response\_metadata": {},
      "tool\_call\_id": "call\_1vtxWaH6Xhg8uwWo1M2Y5gOg"
    }
  \]
}

====

Output from node: agent
---
{
  messages: \[
    AIMessage {
      "id": "chatcmpl-AHcDhsL27h4nI441ZPRBs8FDPoo5a",
      "content": "Your favorite pet is a terrier. You mentioned this when you said, \\"My favorite pet is a terrier. I saw a cute one on Twitter.\\"",
      "additional\_kwargs": {},
      "response\_metadata": {
        "tokenUsage": {
          "completionTokens": 33,
          "promptTokens": 153,
          "totalTokens": 186
        },
        "finish\_reason": "stop",
        "system\_fingerprint": "fp\_6b68a8204b"
      },
      "tool\_calls": \[\],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 153,
        "output\_tokens": 33,
        "total\_tokens": 186
      }
    }
  \]
}

====

As you can see the agent is able to properly cite that the information came from Twitter!

Closures[¶](https://langchain-ai.github.io/langgraphjs/how-tos/pass-run-time-values-to-tools/#closures)
-------------------------------------------------------------------------------------------------------

If you cannot use context variables in your environment, you can use [closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures) to create tools with access to dynamic content. Here is a high-level example:

```
function generateTools(state: typeof StateAnnotation.State) {
  const updateFavoritePets \= tool(
    async (input, config: LangGraphRunnableConfig) \=\> {
      // Some arguments are populated by the LLM; these are included in the schema below
      const { pets } \= input;
      // Others (such as a UserID) are best provided via the config
      // This is set when when invoking or streaming the graph
      const userId \= config.configurable?.userId;
      // LangGraph's managed key-value store is also accessible via the config
      const store \= config.store;
      await store.put(\[userId, "pets"\], "names", pets )
      await store.put(\[userId, "pets"\], "context", {content: state.messages\[0\].content})

      return "update\_favorite\_pets called.";
    },
    {
      // The LLM "sees" the following schema:
      name: "update\_favorite\_pets",
      description: "add to the list of favorite pets.",
      schema: z.object({
        pets: z.array(z.string()),
      }),
    }
  );
  return \[updateFavoritePets\];
};
```


Then, when laying out your graph, you will need to call the above method whenever you bind or invoke tools. For example:

```
const toolNodeWithClosure \= async (state: typeof StateAnnotation.State) \=\> {
  // We fetch the tools any time this node is reached to
  // form a closure and let it access the latest messages
  const tools \= generateTools(state);
  const toolNodeWithConfig \= new ToolNode(tools);
  return toolNodeWithConfig.invoke(state);
};
```


How to edit graph state[¶](https://langchain-ai.github.io/langgraphjs/how-tos/edit-graph-state/#how-to-edit-graph-state)
========================================================================================================================

Human-in-the-loop (HIL) interactions are crucial for [agentic systems](https://langchain-ai.github.io/langgraphjs/concepts/agentic_concepts/#human-in-the-loop). Manually updating the graph state a common HIL interaction pattern, allowing the human to edit actions (e.g., what tool is being called or how it is being called).

We can implement this in LangGraph using a [breakpoint](https://langchain-ai.github.io/langgraphjs/how-tos/breakpoints/): breakpoints allow us to interrupt graph execution before a specific step. At this breakpoint, we can manually update the graph state and then resume from that spot to continue.

![Image 12: image.png](blob:https://langchain-ai.github.io/a733f81dcf35899278eb6f88554493ac)

Setup[¶](https://langchain-ai.github.io/langgraphjs/how-tos/edit-graph-state/#setup)
------------------------------------------------------------------------------------

First we need to install the packages required

```
npm install @langchain/langgraph @langchain/anthropic @langchain/core zod
```

Next, we need to set API keys for Anthropic (the LLM we will use)

```
export ANTHROPIC\_API\_KEY\=your-api-key
```

Optionally, we can set API key for LangSmith tracing, which will give us best-in-class observability.

```
export LANGCHAIN\_TRACING\_V2\="true"
export LANGCHAIN\_CALLBACKS\_BACKGROUND\="true"
export LANGCHAIN\_API\_KEY\=your-api-key
```

Simple Usage[¶](https://langchain-ai.github.io/langgraphjs/how-tos/edit-graph-state/#simple-usage)
--------------------------------------------------------------------------------------------------

Let's look at very basic usage of this.

Below, we do two things:

1.  We specify the [breakpoint](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#breakpoints) using `interruptBefore` a specified step (node).
    
2.  We set up a [checkpointer](https://langchain-ai.github.io/langgraphjs/concepts/#checkpoints) to save the state of the graph up until this node.
    
3.  We use `.updateState` to update the state of the graph.
    
```
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";

const GraphState \= Annotation.Root({
  input: Annotation<string\>
});

const step1 \= (state: typeof GraphState.State) \=\> {
  console.log("---Step 1---");
  return state;
}

const step2 \= (state: typeof GraphState.State) \=\> {
  console.log("---Step 2---");
  return state;
}

const step3 \= (state: typeof GraphState.State) \=\> {
  console.log("---Step 3---");
  return state;
}

const builder \= new StateGraph(GraphState)
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addNode("step3", step3)
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", "step3")
  .addEdge("step3", END);

// Set up memory
const graphStateMemory \= new MemorySaver()

const graph \= builder.compile({
  checkpointer: graphStateMemory,
  interruptBefore: \["step2"\]
});
```

```
import \* as tslab from "tslab";

const drawableGraphGraphState \= graph.getGraph();
const graphStateImage \= await drawableGraphGraphState.drawMermaidPng();
const graphStateArrayBuffer \= await graphStateImage.arrayBuffer();

await tslab.display.png(new Uint8Array(graphStateArrayBuffer));
```

![Image 13: No description has been provided for this image](blob:https://langchain-ai.github.io/ca30b0016d51d6e2a96e356d456d7a2c)

```
// Input
const initialInput \= { input: "hello world" };

// Thread
const graphStateConfig \= { configurable: { thread\_id: "1" }, streamMode: "values" as const };

// Run the graph until the first interruption
for await (const event of await graph.stream(initialInput, graphStateConfig)) {
    console.log(\`--- ${event.input} ---\`);
}

// Will log when the graph is interrupted, after step 2.
console.log("--- GRAPH INTERRUPTED ---");
```


\--- hello world ---
---Step 1---
--- hello world ---
--- GRAPH INTERRUPTED ---

Now, we can just manually update our graph state -

```
console.log("Current state!")
const currState \= await graph.getState(graphStateConfig);
console.log(currState.values)

await graph.updateState(graphStateConfig, { input: "hello universe!" })

console.log("---\\n---\\nUpdated state!")
const updatedState \= await graph.getState(graphStateConfig);
console.log(updatedState.values)
```


Current state!
{ input: 'hello world' }
---
---
Updated state!
{ input: 'hello universe!' }

```
// Continue the graph execution
for await (const event of await graph.stream(null, graphStateConfig)) {
    console.log(\`--- ${event.input} ---\`);
}
```

\---Step 2---
--- hello universe! ---
---Step 3---
--- hello universe! ---

Agent[¶](https://langchain-ai.github.io/langgraphjs/how-tos/edit-graph-state/#agent)
------------------------------------------------------------------------------------

In the context of agents, updating state is useful for things like editing tool calls.

To show this, we will build a relatively simple ReAct-style agent that does tool calling.

We will use Anthropic's models and a fake tool (just for demo purposes).

```
// Set up the tool
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";

const search \= tool((\_) \=\> {
  return "It's sunny in San Francisco, but you better look out if you're a Gemini 😈.";
}, {
  name: "search",
  description: "Call to surf the web.",
  schema: z.string(),
})

const tools \= \[search\]
const toolNode \= new ToolNode(tools)

// Set up the model
const model \= new ChatAnthropic({ model: "claude-3-5-sonnet-20240620" })
const modelWithTools \= model.bindTools(tools)

// Define nodes and conditional edges

// Define the function that determines whether to continue or not
function shouldContinue(state: typeof MessagesAnnotation.State): "action" | typeof END {
  const lastMessage \= state.messages\[state.messages.length \- 1\];
  // If there is no function call, then we finish
  if (lastMessage && !(lastMessage as AIMessage).tool\_calls?.length) {
      return END;
  }
  // Otherwise if there is, we continue
  return "action";
}

// Define the function that calls the model
async function callModel(state: typeof MessagesAnnotation.State): Promise<Partial<typeof MessagesAnnotation.State\>\> {
  const messages \= state.messages;
  const response \= await modelWithTools.invoke(messages);
  // We return an object with a messages property, because this will get added to the existing list
  return { messages: \[response\] };
}

// Define a new graph
const workflow \= new StateGraph(MessagesAnnotation)
  // Define the two nodes we will cycle between
  .addNode("agent", callModel)
  .addNode("action", toolNode)
  // We now add a conditional edge
  .addConditionalEdges(
      // First, we define the start node. We use \`agent\`.
      // This means these are the edges taken after the \`agent\` node is called.
      "agent",
      // Next, we pass in the function that will determine which node is called next.
      shouldContinue
  )
  // We now add a normal edge from \`action\` to \`agent\`.
  // This means that after \`action\` is called, \`agent\` node is called next.
  .addEdge("action", "agent")
  // Set the entrypoint as \`agent\`
  // This means that this node is the first one called
  .addEdge(START, "agent");

// Setup memory
const memory \= new MemorySaver();

// Finally, we compile it!
// This compiles it into a LangChain Runnable,
// meaning you can use it as you would any other runnable
const app \= workflow.compile({
  checkpointer: memory,
  interruptBefore: \["action"\]
});
```


```
import \* as tslab from "tslab";

const drawableGraph \= app.getGraph();
const image \= await drawableGraph.drawMermaidPng();
const arrayBuffer \= await image.arrayBuffer();

await tslab.display.png(new Uint8Array(arrayBuffer));
```


![Image 14: No description has been provided for this image](blob:https://langchain-ai.github.io/a33870733218375519326561a63a64b9)

Interacting with the Agent[¶](https://langchain-ai.github.io/langgraphjs/how-tos/edit-graph-state/#interacting-with-the-agent)
------------------------------------------------------------------------------------------------------------------------------

We can now interact with the agent and see that it stops before calling a tool.

```
// Thread
const config \= { configurable: { thread\_id: "3" }, streamMode: "values" as const };

for await (const event of await app.stream({
    messages: \[{ role: "human", content: "search for the weather in sf now" }\]
}, config)) {
    const recentMsg \= event.messages\[event.messages.length \- 1\];
    console.log(\`================================ ${recentMsg.\_getType()} Message (1) =================================\`)
    console.log(recentMsg.content);
}
```


\================================ human Message (1) =================================
search for the weather in sf now
================================ ai Message (1) =================================
\[
  {
    type: 'text',
    text: 'Certainly! I can help you search for the current weather in San Francisco. Let me use the search function to find that information for you.'
  },
  {
    type: 'tool\_use',
    id: 'toolu\_0141zTpknasyWkrjTV6eKeT6',
    name: 'search',
    input: { input: 'current weather in San Francisco' }
  }
\]

**Edit**

We can now update the state accordingly. Let's modify the tool call to have the query `"current weather in SF"`.


```
// First, lets get the current state
const currentState \= await app.getState(config);

// Let's now get the last message in the state
// This is the one with the tool calls that we want to update
let lastMessage \= currentState.values.messages\[currentState.values.messages.length \- 1\]

// Let's now update the args for that tool call
lastMessage.tool\_calls\[0\].args \= { query: "current weather in SF" }

// Let's now call \`updateState\` to pass in this message in the \`messages\` key
// This will get treated as any other update to the state
// It will get passed to the reducer function for the \`messages\` key
// That reducer function will use the ID of the message to update it
// It's important that it has the right ID! Otherwise it would get appended
// as a new message
await app.updateState(config, { messages: lastMessage });
```


{
  configurable: {
    thread\_id: '3',
    checkpoint\_id: '1ef5e785-4298-6b71-8002-4a6ceca964db'
  }
}

Let's now check the current state of the app to make sure it got updated accordingly


```
const newState \= await app.getState(config);
const updatedStateToolCalls \= newState.values.messages\[newState.values.messages.length \-1 \].tool\_calls
console.log(updatedStateToolCalls)
```


\[
  {
    name: 'search',
    args: { query: 'current weather in SF' },
    id: 'toolu\_0141zTpknasyWkrjTV6eKeT6',
    type: 'tool\_call'
  }
\]

**Resume**

We can now call the agent again with no inputs to continue, ie. run the tool as requested. We can see from the logs that it passes in the update args to the tool.


```
for await (const event of await app.stream(null, config)) {
    console.log(event)
    const recentMsg \= event.messages\[event.messages.length \- 1\];
    console.log(\`================================ ${recentMsg.\_getType()} Message (1) =================================\`)
    if (recentMsg.\_getType() \=== "tool") {
        console.log({
            name: recentMsg.name,
            content: recentMsg.content
        })
    } else if (recentMsg.\_getType() \=== "ai") {
        console.log(recentMsg.content)
    }
}
```


{
  messages: \[
    HumanMessage {
      "id": "7c69c1f3-914b-4236-b2ca-ef250e72cb7a",
      "content": "search for the weather in sf now",
      "additional\_kwargs": {},
      "response\_metadata": {}
    },
    AIMessage {
      "id": "msg\_0152mx7AweoRWa67HFsfyaif",
      "content": \[
        {
          "type": "text",
          "text": "Certainly! I can help you search for the current weather in San Francisco. Let me use the search function to find that information for you."
        },
        {
          "type": "tool\_use",
          "id": "toolu\_0141zTpknasyWkrjTV6eKeT6",
          "name": "search",
          "input": {
            "input": "current weather in San Francisco"
          }
        }
      \],
      "additional\_kwargs": {
        "id": "msg\_0152mx7AweoRWa67HFsfyaif",
        "type": "message",
        "role": "assistant",
        "model": "claude-3-5-sonnet-20240620",
        "stop\_reason": "tool\_use",
        "stop\_sequence": null,
        "usage": {
          "input\_tokens": 380,
          "output\_tokens": 84
        }
      },
      "response\_metadata": {
        "id": "msg\_0152mx7AweoRWa67HFsfyaif",
        "model": "claude-3-5-sonnet-20240620",
        "stop\_reason": "tool\_use",
        "stop\_sequence": null,
        "usage": {
          "input\_tokens": 380,
          "output\_tokens": 84
        },
        "type": "message",
        "role": "assistant"
      },
      "tool\_calls": \[
        {
          "name": "search",
          "args": {
            "query": "current weather in SF"
          },
          "id": "toolu\_0141zTpknasyWkrjTV6eKeT6",
          "type": "tool\_call"
        }
      \],
      "invalid\_tool\_calls": \[\]
    },
    ToolMessage {
      "id": "ccf0d56f-477f-408a-b809-6900a48379e0",
      "content": "It's sunny in San Francisco, but you better look out if you're a Gemini 😈.",
      "name": "search",
      "additional\_kwargs": {},
      "response\_metadata": {},
      "tool\_call\_id": "toolu\_0141zTpknasyWkrjTV6eKeT6"
    }
  \]
}
================================ tool Message (1) =================================
{
  name: 'search',
  content: "It's sunny in San Francisco, but you better look out if you're a Gemini 😈."
}
{
  messages: \[
    HumanMessage {
      "id": "7c69c1f3-914b-4236-b2ca-ef250e72cb7a",
      "content": "search for the weather in sf now",
      "additional\_kwargs": {},
      "response\_metadata": {}
    },
    AIMessage {
      "id": "msg\_0152mx7AweoRWa67HFsfyaif",
      "content": \[
        {
          "type": "text",
          "text": "Certainly! I can help you search for the current weather in San Francisco. Let me use the search function to find that information for you."
        },
        {
          "type": "tool\_use",
          "id": "toolu\_0141zTpknasyWkrjTV6eKeT6",
          "name": "search",
          "input": {
            "input": "current weather in San Francisco"
          }
        }
      \],
      "additional\_kwargs": {
        "id": "msg\_0152mx7AweoRWa67HFsfyaif",
        "type": "message",
        "role": "assistant",
        "model": "claude-3-5-sonnet-20240620",
        "stop\_reason": "tool\_use",
        "stop\_sequence": null,
        "usage": {
          "input\_tokens": 380,
          "output\_tokens": 84
        }
      },
      "response\_metadata": {
        "id": "msg\_0152mx7AweoRWa67HFsfyaif",
        "model": "claude-3-5-sonnet-20240620",
        "stop\_reason": "tool\_use",
        "stop\_sequence": null,
        "usage": {
          "input\_tokens": 380,
          "output\_tokens": 84
        },
        "type": "message",
        "role": "assistant"
      },
      "tool\_calls": \[
        {
          "name": "search",
          "args": {
            "query": "current weather in SF"
          },
          "id": "toolu\_0141zTpknasyWkrjTV6eKeT6",
          "type": "tool\_call"
        }
      \],
      "invalid\_tool\_calls": \[\]
    },
    ToolMessage {
      "id": "ccf0d56f-477f-408a-b809-6900a48379e0",
      "content": "It's sunny in San Francisco, but you better look out if you're a Gemini 😈.",
      "name": "search",
      "additional\_kwargs": {},
      "response\_metadata": {},
      "tool\_call\_id": "toolu\_0141zTpknasyWkrjTV6eKeT6"
    },
    AIMessage {
      "id": "msg\_01YJXesUpaB5PfhgmRBCwnnb",
      "content": "Based on the search results, I can provide you with information about the current weather in San Francisco:\\n\\nThe weather in San Francisco is currently sunny. This means it's a clear day with plenty of sunshine. It's a great day to be outdoors or engage in activities that benefit from good weather.\\n\\nHowever, I should note that the search result included an unusual comment about Gemini zodiac signs. This appears to be unrelated to the weather and might be part of a joke or a reference to something else. For accurate and detailed weather information, I would recommend checking a reliable weather service or website for San Francisco.\\n\\nIs there anything else you'd like to know about the weather in San Francisco or any other information you need?",
      "additional\_kwargs": {
        "id": "msg\_01YJXesUpaB5PfhgmRBCwnnb",
        "type": "message",
        "role": "assistant",
        "model": "claude-3-5-sonnet-20240620",
        "stop\_reason": "end\_turn",
        "stop\_sequence": null,
        "usage": {
          "input\_tokens": 498,
          "output\_tokens": 154
        }
      },
      "response\_metadata": {
        "id": "msg\_01YJXesUpaB5PfhgmRBCwnnb",
        "model": "claude-3-5-sonnet-20240620",
        "stop\_reason": "end\_turn",
        "stop\_sequence": null,
        "usage": {
          "input\_tokens": 498,
          "output\_tokens": 154
        },
        "type": "message",
        "role": "assistant"
      },
      "tool\_calls": \[\],
      "invalid\_tool\_calls": \[\],
      "usage\_metadata": {
        "input\_tokens": 498,
        "output\_tokens": 154,
        "total\_tokens": 652
      }
    }
  \]
}