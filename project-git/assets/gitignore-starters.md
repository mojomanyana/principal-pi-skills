# `.gitignore` Starters

Common patterns by stack. Drop into `.gitignore` at the repo root, combining sections as your project requires. For canonical/exhaustive lists, see [github/gitignore](https://github.com/github/gitignore) — these are pared-down starters for common cases.

The **secrets and credentials** section at the bottom is universal: include it regardless of stack.

---

## Node.js / JavaScript / TypeScript

```gitignore
# Dependencies
node_modules/
.pnp/
.pnp.js
.yarn/cache
.yarn/install-state.gz

# Build output
dist/
build/
out/
.next/
.nuxt/
.svelte-kit/
.astro/

# Testing
coverage/
*.lcov
.nyc_output/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Local config / env
.env
.env.local
.env.*.local

# Editor / OS
.DS_Store
*.swp
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json   # if you want to share team settings

# Misc
*.tsbuildinfo
.cache/
```

---

## Python

```gitignore
# Bytecode
__pycache__/
*.py[cod]
*$py.class

# Distribution / packaging
dist/
build/
*.egg-info/
*.egg
.eggs/

# Virtual environments
.venv/
venv/
env/
ENV/

# Testing / coverage
.pytest_cache/
.coverage
.coverage.*
htmlcov/
.tox/
.nox/
.hypothesis/

# Type checkers / linters
.mypy_cache/
.ruff_cache/
.pyre/

# Tooling
.python-version       # if using pyenv, often NOT ignored — depends on team norm
poetry.lock           # USUALLY committed; uncomment to ignore (rarely correct)

# Editor / OS
.DS_Store
*.swp
.idea/
.vscode/

# Local config / env
.env
.env.*
```

---

## Go

```gitignore
# Binaries
*.exe
*.test
*.prof
*.out
/bin/

# Build cache (Go modules workspace)
go.work
go.work.sum

# Vendor (often committed for reproducible builds; uncomment to ignore)
# /vendor/

# Editor / OS
.DS_Store
.idea/
.vscode/
```

---

## Rust

```gitignore
# Build
/target/
**/*.rs.bk
Cargo.lock          # IGNORE for libraries; COMMIT for binaries / applications

# Tooling
.cargo/
.rustup/

# IDE
.idea/
.vscode/
```

(The `Cargo.lock` rule is one of the most-debated lines in Rust. Convention: libraries published on crates.io ignore it; binaries / applications commit it.)

---

## Java / Kotlin / JVM

```gitignore
# Build
target/
build/
*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*

# Gradle
.gradle/
gradle-app.setting

# Maven
dependency-reduced-pom.xml

# IDE
.idea/
*.iml
.classpath
.project
.settings/

# Editor / OS
.DS_Store
```

---

## Docker / Container

```gitignore
# Build context overrides
.dockerignore        # this file itself; gitignore typically does NOT ignore .dockerignore

# Local docker-compose overrides
docker-compose.override.yml
docker-compose.local.yml
```

(A `.dockerignore` file lives alongside `Dockerfile` and is what Docker reads — separate from `.gitignore`. Both should usually exist.)

---

## Terraform / Infrastructure-as-Code

```gitignore
# Local state (NEVER commit; contains secrets and resource IDs)
*.tfstate
*.tfstate.*
*.tfstate.backup

# Variable files (often contain secrets)
*.tfvars
*.auto.tfvars
!example.tfvars
!terraform.example.tfvars

# Lock files (commit for reproducibility — DO NOT add to gitignore)
# .terraform.lock.hcl

# .terraform dir (downloaded modules / providers)
.terraform/
crash.log
crash.*.log

# Override files (local-only)
override.tf
override.tf.json
*_override.tf
*_override.tf.json
```

---

## Ansible / Pulumi / general IaC

```gitignore
# Pulumi
Pulumi.*.yaml          # stack configs may contain secrets — review per project
.pulumi/

# Ansible
*.retry
host_vars/*.yml.local
group_vars/*.yml.local
```

---

## Mobile — iOS

```gitignore
# Xcode
build/
DerivedData/
*.xcuserstate
xcuserdata/

# CocoaPods
Pods/
!Pods/Local Podspecs/

# Carthage
Carthage/Build/

# Fastlane
fastlane/report.xml
fastlane/screenshots/**/*.png
fastlane/test_output/
```

---

## Mobile — Android

```gitignore
# Build
.gradle/
build/
captures/
*.apk
*.aar
*.ap_
*.dex

# Files
local.properties
proguard/
gen/
output.json

# IntelliJ / Android Studio
.idea/
*.iml
```

---

## Data science / ML

```gitignore
# Notebooks
.ipynb_checkpoints/

# Data (usually NOT in git; use DVC, S3, or similar)
/data/raw/
/data/processed/

# Models
*.pkl
*.joblib
*.h5
*.onnx
*.pt
*.bin
*.safetensors
*.ckpt

# Experiment tracking
mlruns/
wandb/
.neptune/
```

---

## Secrets and credentials (UNIVERSAL — include in every repo)

```gitignore
# Environment files (NEVER commit; use .env.example as the template)
.env
.env.*
!.env.example
!.env.template
!.env.sample

# Cloud credentials
.aws/
.gcp/
.azure/
.gcloud/
.config/gcloud/

# SSH and PGP keys
*.pem
*.key
*.p12
*.pfx
id_rsa
id_rsa.pub
id_dsa
id_dsa.pub
id_ecdsa
id_ecdsa.pub
id_ed25519
id_ed25519.pub

# Generic
secrets/
secrets.yml
secrets.yaml
secrets.json
*.secrets
credentials/
credentials.json

# Auth-tool config
.netrc
.pypirc                 # PyPI upload credentials
.npmrc                  # if it contains _authToken
```

---

## OS and editor (universal)

```gitignore
# macOS
.DS_Store
.AppleDouble
.LSOverride
Icon

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini

# Linux
*~

# Editors
.idea/
.vscode/
*.swp
*.swo
*.bak
*.tmp
```

---

## How to apply `.gitignore` to files git is already tracking

A change to `.gitignore` does NOT untrack files that git already knows about. To stop tracking after updating `.gitignore`:

```bash
# Untrack a single file (keep on disk)
git rm --cached path/to/file

# Untrack all files matching the new ignore rules
git rm -r --cached .
git add .
git commit -m "chore: apply updated .gitignore"
```

---

## How to view what your `.gitignore` actually does

```bash
# Check if a path is ignored, and which rule matched
git check-ignore -v path/to/file

# List all currently tracked files (none should match .gitignore)
git ls-files
```

---

## Notes

- **Don't ignore lock files unless you mean to.** `package-lock.json`, `yarn.lock`, `Pipfile.lock`, `Cargo.lock` (for apps), `go.sum`, `.terraform.lock.hcl` — these go IN the repo. Many of the canonical starter `.gitignore` files have these listed as comments specifically to remind you not to ignore them.
- **`.env.example` should be committed.** It's the template documenting what variables a developer needs without leaking the values.
- **Be explicit, not clever.** A long, readable `.gitignore` is better than a short one full of overly-broad globs.
- **When ignoring whole directories, end with a slash.** `node_modules/` not `node_modules`. The slash makes the intent explicit.
- **If you ever accidentally commit a secret**, ignoring it after the fact does NOT remove it from history. See [safety-and-secrets.md §3](../references/safety-and-secrets.md) in this skill for the full leak response.
