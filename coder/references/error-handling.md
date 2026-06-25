# Error Handling

> *"Stop when blocked. Surface, don't suppress."* — Tenet 6 corollary

How a piece of code handles errors is part of its contract. Get it wrong and the failure mode shifts from "loud and useful" (a stack trace pointing at the cause) to "silent and harmful" (the code limps along with corrupt state).

This reference describes how to choose between defensive handling and fail-fast, when to wrap vs. propagate, and the specific anti-patterns AI coding agents tend toward.

---

## 1. The two philosophies

### Defensive

> "Never crash. Always return something. Log on the way past."

Defensive code catches exceptions widely, returns default values, retries silently, and logs.

**Where defensive fits:**

- Public-facing entry points where crashing exposes internals or kills user requests.
- Background jobs where one bad record shouldn't kill the whole batch.
- Network calls where transient failures are common.
- UI code where a malformed item shouldn't blank the page.

### Fail-fast

> "If the invariant doesn't hold, crash. Bugs surface immediately."

Fail-fast code uses assertions, throws on unexpected input, and doesn't try to recover from impossible states.

**Where fail-fast fits:**

- Internal functions where the caller is responsible for valid input.
- Setup / configuration code where a broken config means the service can't run anyway.
- Test code where a "soft" failure hides the real bug.
- Anywhere a wrong recovery would be worse than a crash (e.g., financial code where "default to zero" is dangerous).

**Most codebases use both** — defensive at the boundary, fail-fast within. The convention discovery (`implementation-planner`'s job) reveals which is used where.

---

## 2. Match the codebase

The codebase has a convention. Match it.

**Probe at write-time:**

- Find a sibling function that could fail. How does it handle failure?
- Find an error type imported. What is it; how is it built?
- Find a `try`/`catch` / `match err`. What does it do — return Err? Rethrow? Log + default?

Mirror that. See [`convention-matching.md`](convention-matching.md).

If the codebase uses `Result<T, E>` everywhere: you return `Result<T, E>` too. Don't throw.
If the codebase throws specific subclassed errors: you throw a specific subclassed error.
If the codebase uses Go-style `(value, err)`: you return `(value, err)`.

---

## 3. Don't suppress what you don't understand

The single most dangerous AI coding pattern is **silent error suppression**:

```ts
try {
  doTheThing();
} catch (e) {
  // ignore
}
```

```python
try:
    do_the_thing()
except Exception:
    pass
```

These patterns turn "the code is broken" into "the code is silently broken." Don't write them.

**If you find yourself reaching for a silent catch, STOP and ask:**

1. Why is this error happening?
2. Is this a programming error (bug in our code)?
3. Is this an environmental error (network, disk, race)?
4. What should actually happen when it fires?

The answer is **never** "nothing." Even "log and continue" is something.

**Acceptable patterns:**

```ts
// 1. Log and propagate as a typed Result
try {
  await doTheThing();
} catch (e) {
  logger.error({ msg: "do_the_thing.failed", error: e });
  return Err({ code: "DO_THE_THING_FAILED", cause: e });
}

// 2. Catch a specific error, handle it deliberately
try {
  await readFile(path);
} catch (e) {
  if (e instanceof FileNotFoundError) {
    return defaultContent;  // explicit recovery; deliberate
  }
  throw e;  // anything else, propagate
}

// 3. Wrap with context, rethrow
try {
  await doTheThing();
} catch (e) {
  throw new Error(`failed to process ${itemId}`, { cause: e });
}
```

All three name what's happening. Silent catches don't.

---

## 4. Don't catch what you can't recover from

A common AI failure mode: catching errors to "make the test pass" without fixing the cause:

```ts
async function processOrder(order) {
  try {
    return await placeOrder(order);
  } catch (e) {
    return { success: false };  // "test now passes"
  }
}
```

The test passes because no error escapes. The order isn't placed. The user thinks the order succeeded-with-success-false, which is something the test author didn't think about.

**Rule:** catching is for errors you can *recover from*. If your "recovery" is "return a different value and hope nobody notices", that's not recovery; that's hiding the bug.

When the right answer is "let it crash" — let it crash. Production has a global error handler. Tests have assertions that fail loudly. Both are better than a partial result that pretends everything is fine.

---

## 5. The catch-with-context pattern

When an error propagates through several layers, each layer can add context without obscuring the original:

```ts
// Bottom
async function readUserRow(id: string): Promise<UserRow> {
  const row = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  if (!row) throw new NotFoundError(`user ${id}`);
  return row;
}

// Middle
async function getUser(id: string): Promise<User> {
  try {
    const row = await readUserRow(id);
    return mapToUser(row);
  } catch (e) {
    throw new Error(`getUser(${id}) failed`, { cause: e });
  }
}

// Top
async function handleUserRequest(req): Promise<Response> {
  try {
    const user = await getUser(req.params.id);
    return jsonResponse(user);
  } catch (e) {
    logger.error({ msg: "user_request.failed", id: req.params.id, error: e });
    if (e instanceof NotFoundError) return jsonResponse({ error: "not_found" }, 404);
    return jsonResponse({ error: "internal" }, 500);
  }
}
```

Each layer adds context but preserves `cause`. The bottom-most error survives all the way up; the top layer turns it into a user-facing response without losing the diagnostic info in the logs.

This pattern matches what most well-tested codebases do. Mirror it.

---

## 6. Validation vs. assertion

Two superficially similar but distinct concepts:

- **Validation** is for untrusted input. The user, the network, the file system, the DB. *"This value came from outside — is it valid?"* Validation produces structured errors or rejects (returns `Err`).
- **Assertion** is for invariants you control. *"At this point in the code, I expect X to hold; if it doesn't, my code is buggy."* Assertion produces a crash or panic.

**Don't conflate them.**

```ts
// validation: input came from outside
function login(req: { email: unknown; password: unknown }): Result<Session, AuthError> {
  if (typeof req.email !== "string") return Err({ code: "INVALID_EMAIL" });
  if (typeof req.password !== "string") return Err({ code: "INVALID_PASSWORD" });
  // ...
}

// assertion: at this point, the schema validator should have given us a parsed user
function applyAuthority(user: User & { id: string }) {
  if (!user.id) throw new Error("internal: user.id missing after schema validation");
  // ...
}
```

The validation returns a structured error (typical user-facing path). The assertion crashes because if it fires, the code is broken — and crashing is the only honest response.

---

## 7. Error testing — what the spec should require

When the spec lists a test for an error case, the test asserts:

- **The error code / type.** Specific. Not just "throws an error."
- **The error payload.** Cause, message, fields.
- **The system state.** No partial side effects.
- **The log emission** (if the contract includes logging on error).

```ts
test("login with wrong password returns invalid_credentials error", async () => {
  const result = await login({ email: "a@b.com", password: "wrong" });

  expect(result.isErr()).toBe(true);
  expect(result.error.code).toBe("INVALID_CREDENTIALS");
  expect(result.error.message).toMatch(/email or password/i);

  // No session was created
  expect(await db.sessions.count()).toBe(0);

  // Audit log entry exists
  expect(logSpy).toHaveBeenCalledWith(
    expect.objectContaining({ msg: "auth.login.failed", reason: "wrong_password" })
  );
});
```

A test that asserts "throws an error" without specifying which error passes when the code throws *any* error — including the wrong one.

---

## 8. Async / await error gotchas

Several language-specific traps that bite AI agents:

### JavaScript / TypeScript

- **Unhandled promise rejections** in event handlers — `addEventListener` callbacks that `await` without try/catch. Surface or wrap.
- **Errors in `Promise.all`** — one rejection rejects the whole batch. Use `Promise.allSettled` if you want per-promise results.
- **Synchronous throws in async functions** — they become rejected promises, which look async. Don't mix.

### Python

- **Exceptions in generators / async generators** — must `try`/`except` inside the generator or at the consumer.
- **Bare `except:`** catches `KeyboardInterrupt` and `SystemExit`. Use `except Exception:` unless you specifically want to.

### Go

- **Forgetting to check `err`** — Go's compiler doesn't enforce; use `errcheck` or `golangci-lint`.
- **Wrapping with `fmt.Errorf("%w", err)`** preserves chain; `%v` does not.

### Rust

- **`unwrap` / `expect` in production code** — equivalent to panic on error. Use `?` and propagate.
- **`Result<(), Box<dyn Error>>`** is the catch-all; lose context. Use a specific error enum where possible.

---

## 9. Anti-patterns

- **Silent catch.** The dominant AI failure mode. Don't.
- **Catching `Error` / `Exception` everywhere.** Catch specifics; let unknown errors propagate.
- **Returning a fake "success" on failure.** `{ success: false }` from a catch is hiding, not handling.
- **Asserting on user input.** Validate; don't crash on bad input from outside.
- **Validating on internal invariants.** A validation that "this internal value should be a number" should be an assertion.
- **Errors without `cause`.** Throwing a new error and discarding the original loses the diagnostic chain.
- **Logging at the wrong level.** Errors are `error`; "didn't find a row in optional lookup" is `info` or `debug`.
- **Logging and not surfacing.** Logs alone don't fix anything; the caller still gets the wrong result.
- **Generic error messages.** "Something went wrong." Useless. Be specific.
- **Catching to make a test pass.** Cardinal sin. The test is supposed to catch the bug; catching the bug to make the test pass is exactly backwards.
