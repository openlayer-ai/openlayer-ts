// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Documents extends APIResource {
  /**
   * Retrieve a framework document, including its sections, subsections, and the
   * rules mapped to each.
   *
   * Each section and subsection carries a `ruleCount`, so you can tell which
   * requirements have rules mapped to them before drilling in.
   *
   * @example
   * ```ts
   * const document =
   *   await client.governance.frameworks.documents.retrieve(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { frameworkId: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
   *   );
   * ```
   */
  retrieve(
    documentID: string,
    params: DocumentRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<DocumentRetrieveResponse> {
    const { frameworkId } = params;
    return this._client.get(path`/frameworks/${frameworkId}/documents/${documentID}`, options);
  }

  /**
   * List the documents attached to a framework.
   *
   * A document holds the text of the standard the framework is based on, split into
   * sections and subsections. Retrieve a single document to get that structure,
   * along with the rules mapped to each part of it.
   *
   * @example
   * ```ts
   * const documents =
   *   await client.governance.frameworks.documents.list(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *   );
   * ```
   */
  list(
    frameworkID: string,
    query: DocumentListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DocumentListResponse> {
    return this._client.get(path`/frameworks/${frameworkID}/documents`, { query, ...options });
  }
}

export interface DocumentRetrieveResponse {
  /**
   * The document id.
   */
  id: string;

  /**
   * The creation date.
   */
  dateCreated: string;

  /**
   * The last update date.
   */
  dateUpdated: string;

  /**
   * The framework the document belongs to.
   */
  frameworkId: string;

  /**
   * The document title.
   */
  title: string;

  /**
   * The document's sections, in display order. Only returned when retrieving a
   * single document.
   */
  sections?: Array<DocumentRetrieveResponse.Section>;
}

export namespace DocumentRetrieveResponse {
  export interface Section {
    /**
     * The section id.
     */
    id: string;

    /**
     * The document the section belongs to.
     */
    documentId: string;

    /**
     * The section number as it appears in the source standard.
     */
    number: string;

    /**
     * The position of the section within the document.
     */
    sortOrder: number;

    /**
     * The section title.
     */
    title: string;

    /**
     * How many rules are linked to this section, including its subsections. Use it to
     * decide whether to fetch the section's rules.
     */
    ruleCount?: number;

    /**
     * The rules linked directly to this section.
     */
    rules?: Array<Section.Rule>;

    /**
     * The section's subsections, in display order.
     */
    subsections?: Array<Section.Subsection>;

    /**
     * The section text.
     */
    text?: string | null;
  }

  export namespace Section {
    export interface Rule {
      /**
       * The rule id.
       */
      id: string;

      /**
       * The rule name.
       */
      name: string;

      /**
       * Whether the rule is evaluated once for the whole workspace, or once per project
       * the rule's frameworks apply to.
       */
      scope: 'project' | 'workspace';

      /**
       * `platform` rules are evaluated automatically from the state of your Openlayer
       * workspace. `evidence` rules are satisfied by attaching evidence.
       */
      type: 'platform' | 'evidence';

      /**
       * Configuration for the platform check, when the automation takes parameters.
       */
      automationParams?: { [key: string]: unknown } | null;

      /**
       * Which workspace signal a platform rule checks, for example
       * `monitoring_mode_enabled`, `test_setup`, or `project_owner_set`. `null` for
       * evidence rules.
       */
      automationType?: string | null;

      /**
       * The creation date.
       */
      dateCreated?: string;

      /**
       * The last update date.
       */
      dateUpdated?: string;

      /**
       * Whether the rule is excluded from compliance calculations.
       */
      deactivated?: boolean;

      /**
       * What the rule requires.
       */
      description?: string | null;

      /**
       * The kind of evidence that satisfies the rule. `null` for platform rules.
       */
      evidenceType?: 'document' | 'text' | 'url' | 'categoryValue' | null;

      /**
       * Whether the rule is managed by Openlayer and cannot be edited.
       */
      immutable?: boolean;

      /**
       * How often evidence must be renewed, in days. Once evidence is older than this,
       * the rule result becomes `due_soon` and then `failing`.
       */
      renewalCadenceDays?: number | null;
    }

    export interface Subsection {
      /**
       * The subsection id.
       */
      id: string;

      /**
       * The subsection number as it appears in the source standard.
       */
      number: string;

      /**
       * The section the subsection belongs to.
       */
      sectionId: string;

      /**
       * The position of the subsection within its section.
       */
      sortOrder: number;

      /**
       * The subsection title.
       */
      title: string;

      /**
       * How many rules are linked to this subsection.
       */
      ruleCount?: number;

      /**
       * The rules linked to this subsection.
       */
      rules?: Array<Subsection.Rule>;

      /**
       * The subsection text. This is the requirement your rules are mapped against.
       */
      text?: string | null;
    }

    export namespace Subsection {
      export interface Rule {
        /**
         * The rule id.
         */
        id: string;

        /**
         * The rule name.
         */
        name: string;

        /**
         * Whether the rule is evaluated once for the whole workspace, or once per project
         * the rule's frameworks apply to.
         */
        scope: 'project' | 'workspace';

        /**
         * `platform` rules are evaluated automatically from the state of your Openlayer
         * workspace. `evidence` rules are satisfied by attaching evidence.
         */
        type: 'platform' | 'evidence';

        /**
         * Configuration for the platform check, when the automation takes parameters.
         */
        automationParams?: { [key: string]: unknown } | null;

        /**
         * Which workspace signal a platform rule checks, for example
         * `monitoring_mode_enabled`, `test_setup`, or `project_owner_set`. `null` for
         * evidence rules.
         */
        automationType?: string | null;

        /**
         * The creation date.
         */
        dateCreated?: string;

        /**
         * The last update date.
         */
        dateUpdated?: string;

        /**
         * Whether the rule is excluded from compliance calculations.
         */
        deactivated?: boolean;

        /**
         * What the rule requires.
         */
        description?: string | null;

        /**
         * The kind of evidence that satisfies the rule. `null` for platform rules.
         */
        evidenceType?: 'document' | 'text' | 'url' | 'categoryValue' | null;

        /**
         * Whether the rule is managed by Openlayer and cannot be edited.
         */
        immutable?: boolean;

        /**
         * How often evidence must be renewed, in days. Once evidence is older than this,
         * the rule result becomes `due_soon` and then `failing`.
         */
        renewalCadenceDays?: number | null;
      }
    }
  }
}

export interface DocumentListResponse {
  items: Array<DocumentListResponse.Item>;
}

export namespace DocumentListResponse {
  export interface Item {
    /**
     * The document id.
     */
    id: string;

    /**
     * The creation date.
     */
    dateCreated: string;

    /**
     * The last update date.
     */
    dateUpdated: string;

    /**
     * The framework the document belongs to.
     */
    frameworkId: string;

    /**
     * The document title.
     */
    title: string;

    /**
     * The document's sections, in display order. Only returned when retrieving a
     * single document.
     */
    sections?: Array<Item.Section>;
  }

  export namespace Item {
    export interface Section {
      /**
       * The section id.
       */
      id: string;

      /**
       * The document the section belongs to.
       */
      documentId: string;

      /**
       * The section number as it appears in the source standard.
       */
      number: string;

      /**
       * The position of the section within the document.
       */
      sortOrder: number;

      /**
       * The section title.
       */
      title: string;

      /**
       * How many rules are linked to this section, including its subsections. Use it to
       * decide whether to fetch the section's rules.
       */
      ruleCount?: number;

      /**
       * The rules linked directly to this section.
       */
      rules?: Array<Section.Rule>;

      /**
       * The section's subsections, in display order.
       */
      subsections?: Array<Section.Subsection>;

      /**
       * The section text.
       */
      text?: string | null;
    }

    export namespace Section {
      export interface Rule {
        /**
         * The rule id.
         */
        id: string;

        /**
         * The rule name.
         */
        name: string;

        /**
         * Whether the rule is evaluated once for the whole workspace, or once per project
         * the rule's frameworks apply to.
         */
        scope: 'project' | 'workspace';

        /**
         * `platform` rules are evaluated automatically from the state of your Openlayer
         * workspace. `evidence` rules are satisfied by attaching evidence.
         */
        type: 'platform' | 'evidence';

        /**
         * Configuration for the platform check, when the automation takes parameters.
         */
        automationParams?: { [key: string]: unknown } | null;

        /**
         * Which workspace signal a platform rule checks, for example
         * `monitoring_mode_enabled`, `test_setup`, or `project_owner_set`. `null` for
         * evidence rules.
         */
        automationType?: string | null;

        /**
         * The creation date.
         */
        dateCreated?: string;

        /**
         * The last update date.
         */
        dateUpdated?: string;

        /**
         * Whether the rule is excluded from compliance calculations.
         */
        deactivated?: boolean;

        /**
         * What the rule requires.
         */
        description?: string | null;

        /**
         * The kind of evidence that satisfies the rule. `null` for platform rules.
         */
        evidenceType?: 'document' | 'text' | 'url' | 'categoryValue' | null;

        /**
         * Whether the rule is managed by Openlayer and cannot be edited.
         */
        immutable?: boolean;

        /**
         * How often evidence must be renewed, in days. Once evidence is older than this,
         * the rule result becomes `due_soon` and then `failing`.
         */
        renewalCadenceDays?: number | null;
      }

      export interface Subsection {
        /**
         * The subsection id.
         */
        id: string;

        /**
         * The subsection number as it appears in the source standard.
         */
        number: string;

        /**
         * The section the subsection belongs to.
         */
        sectionId: string;

        /**
         * The position of the subsection within its section.
         */
        sortOrder: number;

        /**
         * The subsection title.
         */
        title: string;

        /**
         * How many rules are linked to this subsection.
         */
        ruleCount?: number;

        /**
         * The rules linked to this subsection.
         */
        rules?: Array<Subsection.Rule>;

        /**
         * The subsection text. This is the requirement your rules are mapped against.
         */
        text?: string | null;
      }

      export namespace Subsection {
        export interface Rule {
          /**
           * The rule id.
           */
          id: string;

          /**
           * The rule name.
           */
          name: string;

          /**
           * Whether the rule is evaluated once for the whole workspace, or once per project
           * the rule's frameworks apply to.
           */
          scope: 'project' | 'workspace';

          /**
           * `platform` rules are evaluated automatically from the state of your Openlayer
           * workspace. `evidence` rules are satisfied by attaching evidence.
           */
          type: 'platform' | 'evidence';

          /**
           * Configuration for the platform check, when the automation takes parameters.
           */
          automationParams?: { [key: string]: unknown } | null;

          /**
           * Which workspace signal a platform rule checks, for example
           * `monitoring_mode_enabled`, `test_setup`, or `project_owner_set`. `null` for
           * evidence rules.
           */
          automationType?: string | null;

          /**
           * The creation date.
           */
          dateCreated?: string;

          /**
           * The last update date.
           */
          dateUpdated?: string;

          /**
           * Whether the rule is excluded from compliance calculations.
           */
          deactivated?: boolean;

          /**
           * What the rule requires.
           */
          description?: string | null;

          /**
           * The kind of evidence that satisfies the rule. `null` for platform rules.
           */
          evidenceType?: 'document' | 'text' | 'url' | 'categoryValue' | null;

          /**
           * Whether the rule is managed by Openlayer and cannot be edited.
           */
          immutable?: boolean;

          /**
           * How often evidence must be renewed, in days. Once evidence is older than this,
           * the rule result becomes `due_soon` and then `failing`.
           */
          renewalCadenceDays?: number | null;
        }
      }
    }
  }
}

export interface DocumentRetrieveParams {
  /**
   * The framework id.
   */
  frameworkId: string;
}

export interface DocumentListParams {
  /**
   * The page to return in a paginated query.
   */
  page?: number;

  /**
   * Maximum number of items to return per page.
   */
  perPage?: number;
}

export declare namespace Documents {
  export {
    type DocumentRetrieveResponse as DocumentRetrieveResponse,
    type DocumentListResponse as DocumentListResponse,
    type DocumentRetrieveParams as DocumentRetrieveParams,
    type DocumentListParams as DocumentListParams,
  };
}
