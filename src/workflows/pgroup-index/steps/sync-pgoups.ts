import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import {
    MEILISEARCH_MODULE,
    MeiliSearchService,
} from "@rokmohar/medusa-plugin-meilisearch/.medusa/server/src/modules/meilisearch";
import { SearchUtils } from "@medusajs/utils";

export type StepInput = {
    filters?: Record<string, unknown>;
    limit?: number;
    offset?: number;
};

export const syncProductsStep = createStep(
    "sync-products",
    async ({ filters, limit, offset }: StepInput, { container }) => {
        const queryService = container.resolve("query");
        const meilisearchService: MeiliSearchService =
            container.resolve(MEILISEARCH_MODULE);

        const entityType = "pgroups";
        const entityName = "pgroups";

        const entityFields =
            await meilisearchService.getFieldsForType(entityType);
        const entityIndexes =
            await meilisearchService.getIndexesByType(entityName);

        const { data: pgroups } = await queryService.graph({
            entity: "pgroup",
            fields: entityFields,
            pagination: {
                take: limit,
                skip: offset,
            },
            filters: {
                ...filters,
            },
        });

        const existingPgroupsIds = new Set(
            (
                await Promise.all(
                    entityIndexes.map((index) =>
                        meilisearchService.search(index, "", {
                            filter: `id IN [${pgroups.map((p) => p.id).join(",")}]`,
                            attributesToRetrieve: ["id"],
                        }),
                    ),
                )
            )
                .flatMap((result) => result.hits)
                .map((hit) => hit.id),
        );

        const productsToDelete = Array.from(existingPgroupsIds).filter(
            (id) => !pgroups.some((p) => p.id === id),
        );


        const indexConfig = (meilisearchService.options.settings || {})[
            "pgroups"
        ];
        
        let transformedDocuments = pgroups;

        if (indexConfig && typeof indexConfig.transformer === "function") {
            transformedDocuments = pgroups.map(indexConfig.transformer);
          }
        await Promise.all(
            entityIndexes.map((index) =>
                meilisearchService.addDocuments(index, transformedDocuments),
            ),
        );
        await Promise.all(
            entityIndexes.map((index) =>
                meilisearchService.deleteDocuments(index, productsToDelete),
            ),
        );

        return new StepResponse({
            pgroups: transformedDocuments,
        });
    },
);
