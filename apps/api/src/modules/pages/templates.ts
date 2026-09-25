import type { DocType } from '@helm/shared';

export interface DocSection {
  heading: string;
  /** What the section must contain; written into the prompt. */
  guidance: string;
}

/**
 * The fixed layout of each document the AI drafts, tuned for ETL (for example Talend) and BI (for
 * example Qlik) delivery. Every draft uses these headings in this order. Changing them changes
 * every future draft: bump DRAFT_PROMPT_VERSION in drafts.service.ts with them.
 */
export const DOC_TEMPLATES: Record<DocType, DocSection[]> = {
  technical_spec: [
    {
      heading: 'Overview',
      guidance:
        'Purpose and business context in two or three sentences, then "In scope" and "Out of ' +
        'scope" as two short lists.',
    },
    {
      heading: 'Source systems',
      guidance:
        'A table with the columns Source | Type | What is read | Frequency or volume | Access. ' +
        'Only sources named in the notes or context.',
    },
    {
      heading: 'Target and data model',
      guidance:
        'The target platform and schemas, then a table with the columns Table | Grain | Keys | ' +
        'Load type (full, incremental, SCD2) and how the tables relate.',
    },
    {
      heading: 'Data flow and transformations',
      guidance:
        'The jobs or pipeline steps from source to target, in run order, as a numbered list. The ' +
        'business rules and calculations. A mapping table with the columns Target column | ' +
        'Source | Rule for the key columns.',
    },
    {
      heading: 'Scheduling and dependencies',
      guidance:
        'When it runs and what triggers it, the run order and upstream dependencies, the ' +
        'expected run time and any SLA.',
    },
    {
      heading: 'Error handling and data quality',
      guidance:
        'The checks performed (row counts, nulls, duplicates, reconciliation), what happens to ' +
        'rejected rows, who is alerted and how, and how to rerun safely.',
    },
    {
      heading: 'Reporting layer',
      guidance:
        'The apps, dashboards or reports that use the data (for example Qlik): key measures and ' +
        'dimensions, filters, refresh and section access. Write "Not in scope." when no ' +
        'reporting is involved.',
    },
    {
      heading: 'Security and access',
      guidance:
        'How credentials are handled (never the credentials themselves), roles and permissions, ' +
        'and any personal or sensitive data and how it is protected.',
    },
    {
      heading: 'Testing',
      guidance:
        'Unit and integration tests, reconciliation against the source, and the UAT scenarios ' +
        'with their acceptance criteria.',
    },
    {
      heading: 'Deployment and configuration',
      guidance:
        'The environments, the deployment steps, configuration and parameters per environment, ' +
        'and how to roll back.',
    },
  ],
  delivery_document: [
    {
      heading: 'Summary',
      guidance:
        'What was delivered, for which client and project, in which cycle or period, and the ' +
        'overall status, in two or three sentences.',
    },
    {
      heading: 'Scope delivered',
      guidance:
        'A table with the columns Item | What it delivers | Status, using ticket keys when known. ' +
        'Then anything planned but not delivered, and why.',
    },
    {
      heading: 'Changes to systems',
      guidance:
        'The pipelines, jobs, data models, reports and configuration that were added or changed, ' +
        'grouped by system.',
    },
    {
      heading: 'Deployment',
      guidance: 'The environments, the date, the steps taken, who deployed, and how to roll back.',
    },
    {
      heading: 'Validation and UAT',
      guidance:
        'The tests run and their results, reconciliation figures, the UAT outcome and who ' +
        'accepted it.',
    },
    {
      heading: 'Known issues and limitations',
      guidance:
        'Open defects, their workarounds, and limitations the client should know about. Write ' +
        '"None known." only when the notes say so.',
    },
    {
      heading: 'Operations and support',
      guidance:
        'Schedules and monitoring, what to do when a run fails, support contacts and hours, and ' +
        'where the runbook is.',
    },
    {
      heading: 'Next steps',
      guidance: 'Planned follow-up work, open decisions and anything needed from the client.',
    },
    {
      heading: 'Sign-off',
      guidance:
        'A table with the columns Name | Role | Date | Signature and two empty rows, one for the ' +
        'client and one for the delivery lead.',
    },
  ],
};
