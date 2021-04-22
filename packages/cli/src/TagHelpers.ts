import {
	getConnection,
} from "typeorm";

import {
	Db,
	ITagDb,
	ITagResponseItem,
	ResponseHelper,
} from ".";

const TAG_NAME_LENGTH_LIMIT = 24;

// ----------------------------------
//              utils
// ----------------------------------

/**
 * Type guard for string array.
 */
function isStringArray(tags: unknown[]): tags is string[] {
	return Array.isArray(tags) && tags.every((value) => typeof value === 'string');
}

/**
 * Format a tags response by stringifying the ID in every `ITagDb` in an array
 * and removing `createdAt` and `updatedAt` to slim down the payload.
 */
export function formatTagsResponse(tags: ITagDb[]): ITagResponseItem[] {
	return tags.map(({ id, name }) => ({ id: id.toString(), name }));
}

/**
 * Sort a tags response by the order of the tag IDs in the incoming request.
 */
export function sortByRequestOrder(
	tagsResponse: ITagDb[],
	tagIds: string[]
) {
	const tagMap = tagsResponse.reduce((acc, tag) => {
		acc[tag.id.toString()] = tag;
		return acc;
	}, {} as { [key: string]: ITagDb });
	return tagIds.map(tagId => tagMap[tagId]);
}

/**
 * Check if a workflow and a tag are related.
 */
async function checkRelated(workflowId: string, tagId: string): Promise<boolean> {
	const result = await getConnection().createQueryBuilder()
		.select()
		.from('workflows_tags', 'workflows_tags')
		.where('workflowId = :workflowId AND tagId = :tagId', { workflowId, tagId })
		.execute();

	return result.length > 0;
}

/**
 * Check whether a tag ID exists in the `tag_entity` table.
 *
 * Used for creating a workflow or updating a tag.
 */
export async function exists(id: string) {
	const tag = await Db.collections.Tag!.findOne({ where: { id }});

	if (!tag) {
		throw new ResponseHelper.ResponseError(`Tag with ID ${id} does not exist.`, undefined, 400);
	}
}

// ----------------------------------
//           validators
// ----------------------------------

/**
 * Validate whether a tag name
 * - is present in the request body,
 * - is a string,
 * - is 1 to 24 characters long, and
 * - does not exist already.
 *
 * Used for creating or updating a tag.
 */
export async function validateName(name: unknown) {
	if (name === undefined) {
		throw new ResponseHelper.ResponseError(`Property 'name' missing from request body.`, undefined, 400);
	}

	if (typeof name !== 'string') {
		throw new ResponseHelper.ResponseError(`Property 'name' must be a string.`, undefined, 400);
	}

	if (name.length <= 0 || name.length > TAG_NAME_LENGTH_LIMIT) {
		throw new ResponseHelper.ResponseError('Tag name must be 1 to 24 characters long.', undefined, 400);
	}
}

/**
 * Validate that the provided tags are not related to a workflow.
 *
 * Used before creating a relation between the provided tags and workflow.
 */
export async function validateRelations(workflowId: string, tagIds: string[]) {
	for (const tagId of tagIds) {
		const areRelated = await checkRelated(workflowId, tagId);

		if (areRelated) {
			throw new ResponseHelper.ResponseError(`Workflow ID ${workflowId} and tag ID ${tagId} are already related.`, undefined, 400);
		}
	}
}

// ----------------------------------
//             queries
// ----------------------------------

/**
 * Retrieve all existing tags, whether related to a workflow or not,
 * including how many workflows each tag is related to.
 */
export async function getAllTagsWithUsageCount(): Promise<Array<{
	id: number;
	name: string;
	usageCount: number
}>> {
	return await getConnection().createQueryBuilder()
		.select('tag_entity.id', 'id')
		.addSelect('tag_entity.name', 'name')
		.addSelect('COUNT(workflow_entity.id)', 'usageCount')
		.from('tag_entity', 'tag_entity')
		.leftJoin('workflows_tags', 'workflows_tags', 'workflows_tags.tagId = tag_entity.id')
		.leftJoin('workflow_entity', 'workflow_entity', 'workflows_tags.workflowId = workflow_entity.id')
		.groupBy('tag_entity.id')
		.getRawMany();
}

/**
 * Retrieve the tags related to a single workflow.
 */
export async function getWorkflowTags(
	workflowId: string
): Promise<Array<{ id: string; name: string }>> {
	return await getConnection()
		.createQueryBuilder()
		.select('tag_entity.id', 'id')
		.addSelect('tag_entity.name', 'name')
		.from('tag_entity', 'tag_entity')
		.leftJoin('workflows_tags', 'workflows_tags', 'workflows_tags.tagId = tag_entity.id')
		.where('workflowId = :workflowId', { workflowId })
		.getRawMany();
}


// ----------------------------------
//             mutations
// ----------------------------------

/**
 * Relate a workflow to one or more tags.
 */
export async function createRelations(workflowId: string, tagIds: string[]) {
	await getConnection().createQueryBuilder()
		.insert()
		.into('workflows_tags')
		.values(tagIds.map(tagId => ({ workflowId, tagId })))
		.execute();
}

/**
 * Remove all tags for a workflow during a tag update operation.
 */
export async function removeRelations(workflowId: string) {
	await getConnection().createQueryBuilder()
		.delete()
		.from('workflows_tags')
		.where('workflowId = :id', { id: workflowId })
		.execute();
}
