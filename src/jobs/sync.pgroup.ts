import { MedusaContainer } from "@medusajs/framework";
import { syncPgroupsWorkflow } from "../workflows/pgroup-index/sync-pgroups";
import { CronJobConfig } from "@rokmohar/medusa-plugin-meilisearch/.medusa/server/src/models/CronJobConfig";

export default async function meilisearchProductsIndexJob(
    container: MedusaContainer,
) {
    const logger = container.resolve("logger");
    logger.info("Starting pgroup indexing...");

    const {
        result: { pgroups },
    } = await syncPgroupsWorkflow(container).run({
        input: {},
    });
    logger.info(`Successfully indexed ${pgroups.length} pgroups`);
}

export const config: CronJobConfig = {
    name: "meilisearch-pgroups-index",
    schedule: "* * * * *",
    numberOfExecutions: 1,
};
