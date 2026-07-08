# Contributing

Thanks for wanting to improve Illustrator MCP!

## Dev setup

```bash
npm install
npm run build        # compile TypeScript to dist/
npm run dev          # watch mode
```

## Adding a tool

Most tools are just a small ExtendScript "body" plus a Zod input schema:

1. Pick or create a file in `src/tools/`.
2. Call `registerIllustratorTool(server, { name, title, description, inputSchema, annotations, build })`.
3. In `build(args)`, return `{ body, params }`:
   - `params` is any JSON value; it becomes the `P` object inside the script.
   - `body` is ExtendScript that may `return` a JSON-serializable value.
4. Use the prelude helpers (`__doc()`, `__color()`, `__setPos()`, `__itemInfo()`,
   `__style()`, `__abRect()`, `__activeAB()`), defined in `src/jsx.ts`.
5. Register the file's `register*` function in `src/index.ts` if it's new.

### Conventions

- Tool names are `illustrator_<snake_case>`.
- Coordinates/sizes are points, top-left origin, Y-down (helpers convert).
- Write clear, actionable error messages (`throw new Error("...")` inside the body).
- Set MCP `annotations` honestly (`readOnlyHint`, `destructiveHint`, …).

## Validating without Illustrator

You can syntax-check every generated script and the MCP handshake without having
Illustrator installed. See the validation approach in the project (a harness that
assembles each tool body via `buildScript` and runs `node --check`, then spawns the
server and lists tools). Run `npm run build` first.

## Testing with Illustrator

Ask your MCP client to run `illustrator_get_status`, then try `create_document`,
`create_rectangle`, etc. Report Illustrator version + OS in issues.

## Pull requests

- Keep changes focused; match the surrounding code style.
- Run `npm run build` (it must pass with no errors).
- Describe what you tested (client, OS, Illustrator version).
