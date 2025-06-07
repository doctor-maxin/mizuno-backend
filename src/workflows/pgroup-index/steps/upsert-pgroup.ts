import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { SearchUtils } from "@medusajs/utils";
import {
    MEILISEARCH_MODULE,
    MeiliSearchService,
} from "@rokmohar/medusa-plugin-meilisearch/.medusa/server/src/modules/meilisearch";

type StepInput = {
    id: string;
};

export const upsertProductGroupStep = createStep(
    "upsert-pgroup",
    async ({ id }: StepInput, { container }) => {
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
            filters: { id },
        });

        const indexConfig = (meilisearchService.options.settings || {})[
            "pgroups"
        ];
        
        let transformedDocuments = pgroups;

        if (indexConfig && typeof indexConfig.transformer === "function") {
            transformedDocuments = pgroups.map(indexConfig.transformer);
          }
        
        await Promise.all(
            transformedDocuments.map(async (pgroup) => {
                {
                    await Promise.all(
                        entityIndexes.map((indexKey) =>
                            meilisearchService.addDocuments(indexKey, [pgroup]),
                        ),
                    );
                }
            }),
        );

        return new StepResponse({
            pgroups,
        });
    },
);
