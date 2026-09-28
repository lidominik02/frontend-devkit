# The Storybook check

Read this while running the Storybook cases in `run` mode. Skip this whole category, by
name, when `project-facts`'s `storybook.declared` is false — a repository with no
Storybook script gets "skipped: no Storybook script" and nothing here is attempted.

## What to check

**A touched shared component has a story.** "Touched" means a component this feature's
diff created or changed that lives in the repository's shared/design-system location —
not every component the page happens to render. A page-specific component with no reuse
intent does not need one just because this check exists.

**It renders in both themes**, if the repository has a dark/light distinction at all —
check `project-facts`'s stack facts or the repository's own theme convention before
treating "both themes" as applicable. A component that throws or renders visibly broken
in one theme is a finding regardless of whether the feature's own page happens to use
that theme.

**`argTypes` match the props.** A story's controls are stale documentation the moment a
prop is added, renamed or removed without updating them — read the component's actual
prop definition and the story's `argTypes` side by side rather than trusting the story
was kept current.

## How to drive it

**When the Storybook environment exposes its own MCP tools**, use them directly to
render a story and inspect its state — check your own tool list for a Storybook-scoped
MCP server the same way `verifying-ui` checks for a browser one, since the exact tool
names depend on which addon a project has installed and are not fixed here.

**Otherwise, call the Skill tool with "core:verifying-ui"**, pointed at the Storybook dev server's URL
instead of the application's — the same observe-fix-observe loop, the same honesty
rules, a different URL. `project-facts`'s `storybook` fact gives the command to serve
it; find the URL it actually printed, exactly as `verifying-ui`'s own Step 2 requires,
never a guessed or default port.

**Reaching a specific story** commonly means the URL includes an `?path=` query naming
the story's id — read it from Storybook's own sidebar navigation (visible in an
accessibility snapshot) rather than guessing the id from the component's file name; a
story's id is derived from its title, which does not always match the file path.

## What is NOT a finding

- A component with no reuse intent lacking a story — this check does not mandate a
  story for every component, only for ones in the shared/design-system location.
- A visual difference from the story's own controls when the feature deliberately
  passes different prop values — the story is a reference for the component's own
  contract, not for how this one feature happens to configure it.
- Storybook itself failing to build for a reason unrelated to this feature's diff — note
  it as a pre-existing issue, the same way `core:reviewer` distinguishes a pre-existing
  defect from one the diff introduced, and do not block this feature's report on it.
