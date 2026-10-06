# Use Chakra UI for the board interface

The board interface is built with Chakra UI v3 instead of hand-written CSS or a utility-first stack such as Tailwind with shadcn/ui. Chakra provides an accessible, themeable component set with first-party LLM documentation (`llms.txt`) and CLI snippets, so the project does not maintain its own design system. We accept the Emotion runtime and a larger client bundle in exchange; the bundle ships prebuilt inside the package, so it does not add install-time dependencies for users.
