# User and Module Assignment Test Plan
## 0. Bugs
THIS SUITE IS UNDER ACTIVE DEVELOPMENT. A LOTS OF BUGS AND IT DOESN'T ALLOW
A NORMAL CRUD AUTOMATION.
1. An error in Nuevo, could be an extra large value for the inputs
like 50+ chars the error it makes disabled the buttons: grabar, nuevo, cargar, deshacer, eliminar.

## 1. Valid User IDs

Use these IDs (Maestros terceros) when creating users in the current database:

1. `32490644`
2. `32489080`
3. `32487428`
4. `32478114`
5. `32490855`
6. `32504161`
7. `32511449`
8. `43256163`
9. `8909147166`

Keep this list aligned with the selected database. Update the IDs if the database changes, since valid IDs depend on its records and rules; stale IDs can cause user creation to fail.

## Application Overview

Plan functional coverage for the authenticated administrator page that lists users, manages user accounts, assigns individual modules and permissions, and verifies access through a clean login context. Module inheritance is excluded due to bugs. Use the existing authentication fixture for administrator flows; use an unauthenticated browser context for credential checks. Treat runtime validation messages and exact control behavior as discovery items.

## Test Scenarios

### 2. User list

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 1.1. Initial list and toolbar state ✅

**File:** `tests/usersModules/user-list.spec.ts`

**Steps:**
  1. Open the user and module assignment page from a fresh authenticated page.
    - expect: The user list is active, the default status filter shows active users, and the list has rows or an explicit empty state.
  2. Inspect the available tabs, grid columns, and toolbar actions.
    - expect: The expected user, module, and inheritance areas are visible; row-dependent areas remain unavailable until a user is opened. Save and undo start disabled.
  3. Attempt to open each row-dependent tab without first opening a user.
    - expect: The tabs remain disabled and no errors occur. The user list remains active and always on screen.

**Implementation summary:** The user list is the default view and all the row items loads
correctly.

#### 1.2. Open a user and verify status filters ✅

**File:** `tests/usersModules/user-list.spec.ts`

**Steps:**
  1. Single-click a row, then open the same row with a double-click.
    - expect: Single selection does not open the account; double-click opens its Usuario tab and enables account tabs.
  2. Switch among active, blocked, and all-user filters; inspect sorting and reload behavior.
    - expect: Rows match each selected status and sorting changes row order. Reload refreshes the list. Compare totals and displayed records with runtime responses when available(Idea1).
    - Msg when there are no blocked users: 'Sin usuarios para el filtro actual
Cambie estado o criterios de busqueda.'
    - Idea1: https://nomina-qa2-api.adacsc.co/api/v1/w-usuarios-modulos/bootstrap inside
    usuarios has the list of ussers shown in the ui. You can compare at least 3 records to see if the list is correct.

**Implementation sumary:** The user list is the default view and all the row items loads correctly. The status filters work as expected and the tab Modulos is enabled.

### 3. User account lifecycle

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 2.1. Create and validate a user

**File:** `tests/usersModules/user-crud.spec.ts`

**Steps:**
  1. Create a uniquely identified test-owned user with required fields, matching passwords, and optional email; save and reload.
    - expect: A success result appears and saved values persist. A subsequent new-user action clears the form.
    - expect: The new user appears in the list and can be opened. The test-owned user is deleted by cleanup.

    #### 2.1.1. Validation checks
  1. Repeat validation with each required field empty, mismatched passwords, duplicate identity and login, invalid email, and empty password.
    - expect: Each invalid case is rejected without creating a record; capture observed validation text and verify whether a save request was sent.


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

### 4. Individual module permissions

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

### 5. Credential and access verification

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

### 6. End-to-end flows

**Seed:** `tests/fixtures/auth.fixture.ts`

#### 5.1. Create, authorize, block, unblock, and clean up

**File:** `tests/usersModules/user-module-e2e.spec.ts`

**Steps:**
  1. Create a unique test user, assign individual modules, save, and log in with that user in a clean context.
    - expect: The account can log in and sees only its assigned modules.
  2. Return as administrator, block the account, verify login rejection, unblock it, then delete it.
    - expect: Each status transition affects login as expected and cleanup removes only the test-owned account.
