# User and Module Assignment Test Plan

## Application Overview

Plan functional coverage for the authenticated administrator page that lists users, manages user accounts, assigns individual modules and permissions, and verifies access through a clean login context. Module inheritance is excluded. Use the existing authentication fixture for administrator flows; use an unauthenticated browser context for credential checks. Treat runtime validation messages and exact control behavior as discovery items.

## Test Scenarios

### 1. User list

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 1.1. Initial list and toolbar state

**File:** `tests/usersModules/user-list.spec.ts`

**Steps:**
  1. Open the user and module assignment page from a fresh authenticated page.
    - expect: The user list is active, the default status filter shows active users, and the list has rows or an explicit empty state.
  2. Inspect the available tabs, grid columns, and toolbar actions.
    - expect: The expected user, module, and inheritance areas are visible; row-dependent areas remain unavailable until a user is opened. Save and undo start disabled.

#### 1.2. Open a user and verify status filters

**File:** `tests/usersModules/user-list.spec.ts`

**Steps:**
  1. Single-click a row, then open the same row with a double-click.
    - expect: Single selection does not open the account; double-click opens its details and enables account tabs.
  2. Switch among active, blocked, and all-user filters; inspect sorting and reload behavior.
    - expect: Rows match each selected status and sorting changes row order. Reload refreshes the list. Compare totals and displayed records with runtime responses when available.

### 2. User account lifecycle

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 2.1. Create and validate a user

**File:** `tests/usersModules/user-crud.spec.ts`

**Steps:**
  1. Create a uniquely identified test-owned user with required fields, matching passwords, and optional email; save and reload.
    - expect: A success result appears and saved values persist. A subsequent new-user action clears the form.
  2. Repeat validation with each required field empty, mismatched passwords, duplicate identity and login, invalid email, and empty password.
    - expect: Each invalid case is rejected without creating a record; capture observed validation text and verify whether a save request was sent.
  3. Check password visibility controls and supported input boundaries.
    - expect: Visibility toggles work. Record accepted or rejected boundary values without saving unexpected data.

#### 2.2. Edit, undo, block, and delete an owned user

**File:** `tests/usersModules/user-crud.spec.ts`

**Steps:**
  1. Open a test-owned existing user and inspect editable fields; update profile values and save, then reload.
    - expect: Identity and login fields are read-only for existing users; editable fields persist.
  2. Change a field and undo; then make another change and leave the account without saving.
    - expect: Undo restores the saved values. Any unsaved-change prompt or preservation behavior is recorded.
  3. Block and unblock the test-owned user; verify both status filters.
    - expect: The user moves to the matching status list and returns after unblocking.
  4. Cancel deletion, then delete only the test-owned user and verify it is absent from all status filters.
    - expect: Cancel preserves the user. Confirmed deletion removes it; never delete pre-existing accounts.

### 3. Individual module permissions

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 3.1. Inspect the module tree and permission dependencies

**File:** `tests/usersModules/module-permissions.spec.ts`

**Steps:**
  1. Open modules for a test-owned user and inspect the tree, group expand/collapse controls, and permission columns.
    - expect: The tree loads and group controls affect only their intended groups.
  2. For a module, enable assignment, then toggle each dependent permission; disable assignment afterward.
    - expect: Dependent permissions become enabled only when assignment is enabled; disabling assignment clears them and prevents interaction.

#### 3.2. Save, reload, and undo permission changes

**File:** `tests/usersModules/module-permissions.spec.ts`

**Steps:**
  1. Assign different permission combinations to modules in multiple groups and save.
    - expect: The selected combinations persist after reload and match the saved state.
  2. Remove a previously assigned module, save, and reload; separately change permissions and undo.
    - expect: Removed access stays removed after reload; undo restores the last saved state.
  3. Open a new test-owned user and inspect module defaults.
    - expect: No modules are assigned by default. Compare the tree with runtime lookup data where available.

### 4. Credential and access verification

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 4.1. Verify credentials and blocked or deleted accounts

**File:** `tests/usersModules/login-verification.spec.ts`

**Steps:**
  1. In a clean browser context without stored authentication, log in as a newly created test user.
    - expect: Valid credentials grant access. Incorrect credentials are rejected.
  2. Block the test user and attempt login; unblock and retry; finally delete the test user and retry.
    - expect: Blocked and deleted accounts are rejected; an unblocked account can log in with valid credentials.

#### 4.2. Verify module visibility and action permissions

**File:** `tests/usersModules/login-verification.spec.ts`

**Steps:**
  1. Assign selected modules and permission combinations to a test user, then log in in a clean context.
    - expect: Assigned modules are available and unassigned modules are absent. Module actions reflect the granted permissions.
  2. Log in as a user with no assigned modules and as a user whose password was changed.
    - expect: Record the observed no-module behavior. The old password fails and the new password succeeds.

### 5. End-to-end flows

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 5.1. Create, authorize, block, unblock, and clean up

**File:** `tests/usersModules/user-module-e2e.spec.ts`

**Steps:**
  1. Create a unique test user, assign individual modules, save, and log in with that user in a clean context.
    - expect: The account can log in and sees only its assigned modules.
  2. Return as administrator, block the account, verify login rejection, unblock it, then delete it.
    - expect: Each status transition affects login as expected and cleanup removes only the test-owned account.
