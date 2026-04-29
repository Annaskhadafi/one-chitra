# Codex Task Management Guide

## Documentation Available

📚 **Project Documentation**: Check the documentation files in this directory for project-specific setup instructions and guides.
**Project Tasks**: Check the tasks directory in documentation/tasks for the list of tasks to be completed. Use the CLI commands below to interact with them.

## MANDATORY Task Management Workflow

🚨 **YOU MUST FOLLOW THIS EXACT WORKFLOW - NO EXCEPTIONS** 🚨

### **STEP 1: DISCOVER TASKS (MANDATORY)**
You MUST start by running this command to see all available tasks:
```bash
task-manager list-tasks
```

### **STEP 2: START EACH TASK (MANDATORY)**
Before working on any task, you MUST mark it as started:
```bash
task-manager start-task <task_id>
```

### **STEP 3: COMPLETE OR CANCEL EACH TASK (MANDATORY)**
After finishing implementation, you MUST mark the task as completed, or cancel if you cannot complete it:
```bash
task-manager complete-task <task_id> "Brief description of what was implemented"
# or
task-manager cancel-task <task_id> "Reason for cancellation"
```

## Task Files Location

📁 **Task Data**: Your tasks are organized in the `documentation/tasks/` directory:
- Task JSON files contain complete task information
- Use ONLY the `task-manager` commands listed above
- Follow the mandatory workflow sequence for each task

## MANDATORY Task Workflow Sequence

🔄 **For EACH individual task, you MUST follow this sequence:**

1. 📋 **DISCOVER**: `task-manager list-tasks` (first time only)
2. 🚀 **START**: `task-manager start-task <task_id>` (mark as in progress)
3. 💻 **IMPLEMENT**: Do the actual coding/implementation work
4. ✅ **COMPLETE**: `task-manager complete-task <task_id> "What was done"` (or cancel with `task-manager cancel-task <task_id> "Reason"`)
5. 🔁 **REPEAT**: Go to next task (start from step 2)

## Task Status Options

- `pending` - Ready to work on
- `in_progress` - Currently being worked on  
- `completed` - Successfully finished
- `blocked` - Cannot proceed (waiting for dependencies)
- `cancelled` - No longer needed

## CRITICAL WORKFLOW RULES

❌ **NEVER skip** the `task-manager start-task` command
❌ **NEVER skip** the `task-manager complete-task` command  (use `task-manager cancel-task` if a task is not planned, not required, or you must stop it)
❌ **NEVER work on multiple tasks simultaneously**
✅ **ALWAYS complete one task fully before starting the next**
✅ **ALWAYS provide completion details in the complete command**
✅ **ALWAYS follow the exact 3-step sequence: list → start → complete (or cancel if not required)**

## graphify

This project has a local graphify knowledge graph in `graphify-out/`.

Token-saving rules:
- For architecture, dependency, ownership, cross-module, or "where is this logic?" questions, check `graphify-out/GRAPH_REPORT.md` before broad file reads.
- If `graphify-out/wiki/index.md` exists, use the wiki/community notes first and open raw source files only for the exact nodes or files needed.
- Prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` before broad grep/search. These commands traverse `graphify-out/graph.json` and usually cost fewer tokens than reading many files.
- The current graph was built AST-only to avoid semantic extraction token cost. Treat it as strong for code structure, imports, calls, classes, and functions; verify behavior-sensitive details in source before editing.
- After modifying code files, run `graphify update .` so `graphify-out/graph.json`, `GRAPH_REPORT.md`, and the wiki stay current.
- Do not run full semantic/deep graph extraction unless the user explicitly accepts the higher token cost.
