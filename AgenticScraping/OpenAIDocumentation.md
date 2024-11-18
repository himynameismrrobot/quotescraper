# Structured Output Documentation
## Introduction
JSON is one of the most widely used formats in the world for applications to exchange data.

Structured Outputs is a feature that ensures the model will always generate responses that adhere to your supplied JSON Schema, so you don't need to worry about the model omitting a required key, or hallucinating an invalid enum value.

Some benefits of Structed Outputs include:

- Reliable type-safety: No need to validate or retry incorrectly formatted responses
- Explicit refusals: Safety-based model refusals are now programmatically detectable
- Simpler prompting: No need for strongly worded prompts to achieve consistent formatting

In addition to supporting JSON Schema in the REST API, the OpenAI SDKs for Python and JavaScript also make it easy to define object schemas using Pydantic and Zod respectively. Below, you can see how to extract information from unstructured text that conforms to a schema defined in code.

Getting a structured response
```
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const CalendarEvent = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
});

const completion = await openai.beta.chat.completions.parse({
  model: "gpt-4o-2024-08-06",
  messages: [
    { role: "system", content: "Extract the event information." },
    { role: "user", content: "Alice and Bob are going to a science fair on Friday." },
  ],
  response_format: zodResponseFormat(CalendarEvent, "event"),
});

const event = completion.choices[0].message.parsed;
```

## Supported Models
Structured Outputs are available in our latest large language models, starting with GPT-4o:

gpt-4o-mini-2024-07-18 and later
gpt-4o-2024-08-06 and later
Older models like gpt-4-turbo and earlier may use JSON mode instead.

## When to use Structured Outputs via function calling vs via response_format

Structured Outputs is available in two forms in the OpenAI API:

When using function calling
When using a json_schema response format
Function calling is useful when you are building an application that bridges the models and functionality of your application.

For example, you can give the model access to functions that query a database in order to build an AI assistant that can help users with their orders, or functions that can interact with the UI.

Conversely, Structured Outputs via response_format are more suitable when you want to indicate a structured schema for use when the model responds to the user, rather than when the model calls a tool.

For example, if you are building a math tutoring application, you might want the assistant to respond to your user using a specific JSON Schema so that you can generate a UI that displays different parts of the model's output in distinct ways.

Put simply:

If you are connecting the model to tools, functions, data, etc. in your system, then you should use function calling
If you want to structure the model's output when it responds to the user, then you should use a structured response_format

The remainder of this guide will focus on non-function calling use cases in the Chat Completions API. To learn more about how to use Structured Outputs with function calling, check out the Function Calling guide.

## Structured Outputs vs JSON mode

Structured Outputs is the evolution of JSON mode. While both ensure valid JSON is produced, only Structured Outputs ensure schema adherance. Both Structured Outputs and JSON mode are supported in the Chat Completions API, Assistants API, Fine-tuning API and Batch API.

We recommend always using Structured Outputs instead of JSON mode when possible.

However, Structured Outputs with response_format: {type: "json_schema", ...} is only supported with the gpt-4o-mini, gpt-4o-mini-2024-07-18, and gpt-4o-2024-08-06 model snapshots and later.

Structured Outputs	JSON Mode
Outputs valid JSON	Yes	Yes
Adheres to schema	Yes (see supported schemas)	No
Compatible models	gpt-4o-mini, gpt-4o-2024-08-06, and later	gpt-3.5-turbo, gpt-4-* and gpt-4o-* models
Enabling	response_format: { type: "json_schema", json_schema: {"strict": true, "schema": ...} }	response_format: { type: "json_object" }

## Structured Data Extraction Example
```
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI();

const ResearchPaperExtraction = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  keywords: z.array(z.string()),
});

const completion = await openai.beta.chat.completions.parse({
  model: "gpt-4o-2024-08-06",
  messages: [
    { role: "system", content: "You are an expert at structured data extraction. You will be given unstructured text from a research paper and should convert it into the given structure." },
    { role: "user", content: "..." },
  ],
  response_format: zodResponseFormat(ResearchPaperExtraction, "research_paper_extraction"),
});

const research_paper = completion.choices[0].message.parsed;
```

## Example Response
```
{
  "title": "Application of Quantum Algorithms in Interstellar Navigation: A New Frontier",
  "authors": [
    "Dr. Stella Voyager",
    "Dr. Nova Star",
    "Dr. Lyra Hunter"
  ],
  "abstract": "This paper investigates the utilization of quantum algorithms to improve interstellar navigation systems. By leveraging quantum superposition and entanglement, our proposed navigation system can calculate optimal travel paths through space-time anomalies more efficiently than classical methods. Experimental simulations suggest a significant reduction in travel time and fuel consumption for interstellar missions.",
  "keywords": [
    "Quantum algorithms",
    "interstellar navigation",
    "space-time anomalies",
    "quantum superposition",
    "quantum entanglement",
    "space travel"
  ]
}
```

## How to use Structured Outputs with response_format

You can use Structured Outputs with the new SDK helper to parse the model's output into your desired format, or you can specify the JSON schema directly.

Note: the first request you make with any schema will have additional latency as our API processes the schema, but subsequent requests with the same schema will not have additional latency.

### Step 1  Define your schema

First you must design the JSON Schema that the model should be constrained to follow. See the examples at the top of this guide for reference.

While Structured Outputs supports much of JSON Schema, some features are unavailable either for performance or technical reasons. See here for more details.

Tips for your JSON Schema
To maximize the quality of model generations, we recommend the following:

Name keys clearly and intuitively
Create clear titles and descriptions for important keys in your structure
Create and use evals to determine the structure that works best for your use case

### Step 2: Supply your schema in the API call

To use Structured Outputs, simply specify

```
response_format: {
    "type": "json_schema",
    "json_schema": … ,
    "strict": true }
```

For example:

```
const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
        { role: "system", content: "You are a helpful math tutor. Guide the user through the solution step by step." },
        { role: "user", content: "how can I solve 8x + 7 = -23" }
    ],
    response_format: {
        type: "json_schema",
        json_schema: {
            name: "math_response",
            schema: {
                type: "object",
                properties: {
                    steps: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                explanation: { type: "string" },
                                output: { type: "string" }
                            },
                            required: ["explanation", "output"],
                            additionalProperties: false
                        }
                    },
                    final_answer: { type: "string" }
                },
                required: ["steps", "final_answer"],
                additionalProperties: false
            },
            strict: true
        }
    }
});

console.log(response.choices[0].message.content);
```

### Step 3: Handle edge cases
In some cases, the model might not generate a valid response that matches the provided JSON schema.

This can happen in the case of a refusal, if the model refuses to answer for safety reasons, or if for example you reach a max tokens limit and the response is incomplete.

```
try {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful math tutor. Guide the user through the solution step by step.",
      },
      { role: "user", content: "how can I solve 8x + 7 = -23" },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "math_response",
        schema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  explanation: { type: "string" },
                  output: { type: "string" },
                },
                required: ["explanation", "output"],
                additionalProperties: false,
              },
            },
            final_answer: { type: "string" },
          },
          required: ["steps", "final_answer"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
    max_tokens: 50,
  });

  if (completion.choices[0].finish_reason === "length") {
    // Handle the case where the model did not return a complete response
    throw new Error("Incomplete response");
  }

  const math_response = completion.choices[0].message;

  if (math_response.refusal) {
    // handle refusal
    console.log(math_response.refusal);
  } else if (math_response.content) {
    console.log(math_response.content);
  } else {
    throw new Error("No response content");
  }
} catch (e) {
  // Handle edge cases
  console.error(e);
}
```

### Step 4: Use the generated structured data in a type-safe way
Typically, when using Structured Outputs you will have a type or class in the type-system of your programming language representing the JSON Schema as an object.

Once you have confirmed that you have received the JSON guaranteed to match the schema you requested, you can now safely parse it to the corresponding type.

For example:
```
// Here we specify types in TypeScript that exactly match the JSON Schema we provided when calling the OpenAI API. Note that these *must* be kept in sync.

type Step = {
  explanation: string;
  output: string;
};

type Solution = {
  steps: Step[];
  final_answer: string;
};

...

// Now so long as the JSON Schema we created was exactly equivalent to our TypeScript types, this is type-safe
const solution = JSON.parse(response.choices[0].message.content)) as Solution
```

## Refusals with Structured Outputs

When using Structured Outputs with user-generated input, OpenAI models may occasionally refuse to fulfill the request for safety reasons. Since a refusal does not necessarily follow the schema you have supplied in response_format, the API response will include a new field called refusal to indicate that the model refused to fulfill the request.

When the refusal property appears in your output object, you might present the refusal in your UI, or include conditional logic in code that consumes the response to handle the case of a refused request.

```
const Step = z.object({
  explanation: z.string(),
  output: z.string(),
});

const MathReasoning = z.object({
  steps: z.array(Step),
  final_answer: z.string(),
});

const completion = await openai.beta.chat.completions.parse({
  model: "gpt-4o-2024-08-06",
  messages: [
    { role: "system", content: "You are a helpful math tutor. Guide the user through the solution step by step." },
    { role: "user", content: "how can I solve 8x + 7 = -23" },
  ],
  response_format: zodResponseFormat(MathReasoning, "math_reasoning"),
});

const math_reasoning = completion.choices[0].message

// If the model refuses to respond, you will get a refusal message
if (math_reasoning.refusal) {
  console.log(math_reasoning.refusal);
} else {
  console.log(math_reasoning.parsed);
}
```

The API response from a refusal will look something like this:

```
{
  "id": "chatcmpl-9nYAG9LPNonX8DAyrkwYfemr3C8HC",
  "object": "chat.completion",
  "created": 1721596428,
  "model": "gpt-4o-2024-08-06",
  "choices": [
    {
	  "index": 0,
	  "message": {
            "role": "assistant",
            // highlight-start
            "refusal": "I'm sorry, I cannot assist with that request."
            // highlight-end
	  },
	  "logprobs": null,
	  "finish_reason": "stop"
	}
  ],
  "usage": {
      "prompt_tokens": 81,
      "completion_tokens": 11,
      "total_tokens": 92,
      "completion_tokens_details": {
        "reasoning_tokens": 0,
        "accepted_prediction_tokens": 0,
        "rejected_prediction_tokens": 0
      }
  },
  "system_fingerprint": "fp_3407719c7f"
}
```

## Tips and best practices

### Handling user-generated input
If your application is using user-generated input, make sure your prompt includes instructions on how to handle situations where the input cannot result in a valid response.

The model will always try to adhere to the provided schema, which can result in hallucinations if the input is completely unrelated to the schema.

You could include language in your prompt to specify that you want to return empty parameters, or a specific sentence, if the model detects that the input is incompatible with the task.

### Handling mistakes
Structured Outputs can still contain mistakes. If you see mistakes, try adjusting your instructions, providing examples in the system instructions, or splitting tasks into simpler subtasks. Refer to the prompt engineering guide for more guidance on how to tweak your inputs.

### Avoid JSON schema divergence
To prevent your JSON Schema and corresponding types in your programming language from diverging, we strongly recommend using the native Pydantic/zod sdk support.

If you prefer to specify the JSON schema directly, you could add CI rules that flag when either the JSON schema or underlying data objects are edited, or add a CI step that auto-generates the JSON Schema from type definitions (or vice-versa).

## Supported schemas
Structured Outputs supports a subset of the JSON Schema language.

### Supported types
The following types are supported for Structured Outputs:

String
Number
Boolean
Integer
Object
Array
Enum
anyOf

### Root objects must not be anyOf
Note that the root level object of a schema must be an object, and not use anyOf. A pattern that appears in Zod (as one example) is using a discriminated union, which produces an anyOf at the top level. So code such as the following won't work:
```
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const BaseResponseSchema = z.object({ /* ... */ });
const UnsuccessfulResponseSchema = z.object({ /* ... */ });

const finalSchema = z.discriminatedUnion('status', [
    BaseResponseSchema,
    UnsuccessfulResponseSchema,
]);

// Invalid JSON Schema for Structured Outputs
const json = zodResponseFormat(finalSchema, 'final_schema');
```

### All fields must be required
To use Structured Outputs, all fields or function parameters must be specified as required.
```
{
    "name": "get_weather",
    "description": "Fetches the weather in the given location",
    "strict": true,
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "The location to get the weather for"
            },
            "unit": {
                "type": "string",
                "description": "The unit to return the temperature in",
                "enum": ["F", "C"]
            }
        },
        "additionalProperties": false,
        // highlight-start
        "required": ["location", "unit"]
        // highlight-end
    }
}
```

Although all fields must be required (and the model will return a value for each parameter), it is possible to emulate an optional parameter by using a union type with null.

```
{
    "name": "get_weather",
    "description": "Fetches the weather in the given location",
    "strict": true,
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "The location to get the weather for"
            },
            "unit": {
                // highlight-start
                "type": ["string", "null"],
                // highlight-end
                "description": "The unit to return the temperature in",
                "enum": ["F", "C"]
            }
        },
        "additionalProperties": false,
        "required": [
            "location", "unit"
        ]
    }
}
```

### Objects have limitations on nesting depth and size
A schema may have up to 100 object properties total, with up to 5 levels of nesting.

Limitations on total string size
In a schema, total string length of all property names, definition names, enum values, and const values cannot exceed 15,000 characters.

### Limitations on enum size
A schema may have up to 500 enum values across all enum properties.

For a single enum property with string values, the total string length of all enum values cannot exceed 7,500 characters when there are more than 250 enum values.

### additionalProperties: false must always be set in objects
additionalProperties controls whether it is allowable for an object to contain additional keys / values that were not defined in the JSON Schema.

Structured Outputs only supports generating specified keys / values, so we require developers to set additionalProperties: false to opt into Structured Outputs.

```
{
    "name": "get_weather",
    "description": "Fetches the weather in the given location",
    "strict": true,
    "schema": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "The location to get the weather for"
            },
            "unit": {
                "type": "string",
                "description": "The unit to return the temperature in",
                "enum": ["F", "C"]
            }
        },
        // highlight-start
        "additionalProperties": false,
        // highlight-end
        "required": [
            "location", "unit"
        ]
    }
}
```
### Key ordering
When using Structured Outputs, outputs will be produced in the same order as the ordering of keys in the schema.

Some type-specific keywords are not yet supported
Notable keywords not supported include:

For strings: minLength, maxLength, pattern, format
For numbers: minimum, maximum, multipleOf
For objects: patternProperties, unevaluatedProperties, propertyNames, minProperties, maxProperties
For arrays: unevaluatedItems, contains, minContains, maxContains, minItems, maxItems, uniqueItems
If you turn on Structured Outputs by supplying strict: true and call the API with an unsupported JSON Schema, you will receive an error.

### For anyOf, the nested schemas must each be a valid JSON Schema per this subset
Here's an example supported anyOf schema:
```
{
	"type": "object",
	"properties": {
		"item": {
			"anyOf": [
				{
					"type": "object",
					"description": "The user object to insert into the database",
					"properties": {
						"name": {
							"type": "string",
							"description": "The name of the user"
						},
						"age": {
							"type": "number",
							"description": "The age of the user"
						}
					},
					"additionalProperties": false,
					"required": [
						"name",
						"age"
					]
				},
				{
					"type": "object",
					"description": "The address object to insert into the database",
					"properties": {
						"number": {
							"type": "string",
							"description": "The number of the address. Eg. for 123 main st, this would be 123"
						},
						"street": {
							"type": "string",
							"description": "The street name. Eg. for 123 main st, this would be main st"
						},
						"city": {
							"type": "string",
							"description": "The city of the address"
						}
					},
					"additionalProperties": false,
					"required": [
						"number",
						"street",
						"city"
					]
				}
			]
		}
	},
	"additionalProperties": false,
	"required": [
		"item"
	]
}
```

### Definitions are supported
You can use definitions to define subschemas which are referenced throughout your schema. The following is a simple example.
```
{
	"type": "object",
	"properties": {
		"steps": {
			"type": "array",
			"items": {
				"$ref": "#/$defs/step"
			}
		},
		"final_answer": {
			"type": "string"
		}
	},
	"$defs": {
		"step": {
			"type": "object",
			"properties": {
				"explanation": {
					"type": "string"
				},
				"output": {
					"type": "string"
				}
			},
			"required": [
				"explanation",
				"output"
			],
			"additionalProperties": false
		}
	},
	"required": [
		"steps",
		"final_answer"
	],
	"additionalProperties": false
}
```

### Recursive schemas are supported
Sample recursive schema using # to indicate root recursion.
```
{
        "name": "ui",
        "description": "Dynamically generated UI",
        "strict": true,
        "schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "description": "The type of the UI component",
                    "enum": ["div", "button", "header", "section", "field", "form"]
                },
                "label": {
                    "type": "string",
                    "description": "The label of the UI component, used for buttons or form fields"
                },
                "children": {
                    "type": "array",
                    "description": "Nested UI components",
                    "items": {
                        "$ref": "#"
                    }
                },
                "attributes": {
                    "type": "array",
                    "description": "Arbitrary attributes for the UI component, suitable for any element",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "The name of the attribute, for example onClick or className"
                            },
                            "value": {
                                "type": "string",
                                "description": "The value of the attribute"
                            }
                        },
                      "additionalProperties": false,
                      "required": ["name", "value"]
                    }
                }
            },
            "required": ["type", "label", "children", "attributes"],
            "additionalProperties": false
        }
    }
```

Sample recursive schema using explicit recursion:
```
{
	"type": "object",
	"properties": {
		"linked_list": {
			"$ref": "#/$defs/linked_list_node"
		}
	},
	"$defs": {
		"linked_list_node": {
			"type": "object",
			"properties": {
				"value": {
					"type": "number"
				},
				"next": {
					"anyOf": [
						{
							"$ref": "#/$defs/linked_list_node"
						},
						{
							"type": "null"
						}
					]
				}
			},
			"additionalProperties": false,
			"required": [
				"next",
				"value"
			]
		}
	},
	"additionalProperties": false,
	"required": [
		"linked_list"
	]
}

```

