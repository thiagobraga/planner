# Requirements Document

## Introduction

Create a Styleguide / UI Kit page for the planner application. The page should collect reusable visual patterns, navigation icons, task-row treatments, typography, spacing, and future calendar components in one internal reference screen.

The current Monthly calendar experiment is not required as the production Monthly view yet, but it is useful as a UI component idea. Preserve it in the Styleguide / UI Kit spec so it can be refined without forcing the Monthly product page into a calendar layout.

## Requirements

### Requirement 1: Styleguide Route

**User Story:** As a product builder, I want an internal Styleguide / UI Kit page, so that the app's visual language can be reviewed and extended consistently.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the internal styleguide route, THE Web_Client SHALL render a page titled `Styleguide` or `UI Kit`.
2. THE page SHALL be reachable without changing core task workflows.
3. THE page SHALL not replace Daily, Inbox, Monthly, or Habits views.

### Requirement 2: Monthly Calendar Component

**User Story:** As a product builder, I want the hardcoded Monthly calendar preserved as a UI Kit component, so that the calendar idea can be reviewed later without making it the main Monthly experience.

#### Acceptance Criteria

1. THE Styleguide / UI Kit page SHALL include a Monthly calendar component sample.
2. THE calendar sample SHALL use the existing planner visual language: small serif headings, muted ink, dotted-paper background, and restrained grid lines.
3. THE calendar sample MAY use hardcoded data while it remains a UI Kit specimen.

### Requirement 3: Icon Specimens

**User Story:** As a product builder, I want navigation icon specimens, so that sidebar icons can be compared as a set.

#### Acceptance Criteria

1. THE Styleguide / UI Kit page SHALL include the Daily, Inbox, Monthly, and Habits navigation icons.
2. THE Monthly icon SHALL use a bullet-list mark: three dots aligned with three horizontal lines.
3. Icon specimens SHALL be shown at the same sizes used in expanded and collapsed sidebar modes.
