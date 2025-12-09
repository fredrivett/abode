import Replicate from "replicate";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("lib/embeddings");

const replicate = new Replicate({
	auth: process.env.REPLICATE_API_TOKEN,
});

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Normalize a vector using L2 normalization for inner product optimization
 */
export function normalizeVector(vector: number[]): number[] {
	const magnitude = Math.sqrt(
		vector.reduce((sum, val) => sum + val * val, 0),
	);
	if (magnitude === 0) {
		throw new Error("Cannot normalize zero vector");
	}
	return vector.map((val) => val / magnitude);
}

/**
 * Generate CLIP embedding for an image using Replicate
 * Returns a normalized 512-dimensional vector
 */
export async function generateImageEmbedding(
	imageUrl: string,
): Promise<number[]> {
	try {
		log.info({ imageUrl }, "Generating image embedding with CLIP");

		// Use Replicate's CLIP model
		const output = (await replicate.run(
			"andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a",
			{
				input: {
					inputs: imageUrl,
				},
			},
		)) as number[][];

		// CLIP returns array of arrays, we want the first embedding
		const embedding = output[0];

		if (!embedding || embedding.length !== 512) {
			throw new Error(
				`Invalid embedding dimension: expected 512, got ${embedding?.length}`,
			);
		}

		// Normalize for inner product optimization
		const normalized = normalizeVector(embedding);

		log.info(
			{
				dimension: normalized.length,
				sampleValues: normalized.slice(0, 3),
			},
			"Image embedding generated",
		);

		return normalized;
	} catch (error) {
		log.error({ error, imageUrl }, "Failed to generate image embedding");
		throw error;
	}
}

/**
 * Generate text embedding using OpenAI text-embedding-3-small
 * Returns a normalized 1536-dimensional vector
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
	try {
		log.info({ textLength: text.length }, "Generating text embedding");

		const response = await openai.embeddings.create({
			model: "text-embedding-3-small",
			input: text,
			encoding_format: "float",
		});

		const embedding = response.data[0].embedding;

		if (!embedding || embedding.length !== 1536) {
			throw new Error(
				`Invalid embedding dimension: expected 1536, got ${embedding?.length}`,
			);
		}

		// Normalize for inner product optimization
		const normalized = normalizeVector(embedding);

		log.info(
			{
				dimension: normalized.length,
				sampleValues: normalized.slice(0, 3),
			},
			"Text embedding generated",
		);

		return normalized;
	} catch (error) {
		log.error({ error, textLength: text.length }, "Failed to generate text embedding");
		throw error;
	}
}
