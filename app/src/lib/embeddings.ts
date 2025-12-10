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
 *
 * @param imageUrl - URL to the image or base64 data URI
 */
export async function generateImageEmbedding(
	imageUrl: string,
): Promise<number[]> {
	try {
		log.info(
			{ imageUrl: imageUrl.slice(0, 100) + "..." },
			"Generating image embedding with CLIP",
		);

		// If it's a localhost URL, we need to fetch and convert to data URI
		let imageInput = imageUrl;
		if (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.0.0.1')) {
			const response = await fetch(imageUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.statusText}`);
			}

			const buffer = await response.arrayBuffer();
			const base64 = Buffer.from(buffer).toString('base64');
			const contentType = response.headers.get('content-type') || 'image/png';
			imageInput = `data:${contentType};base64,${base64}`;
		}

		// Use Replicate's CLIP model
		const modelVersion = "andreasjansson/clip-features:75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a";
		const input = { inputs: imageInput };

		const output = (await replicate.run(
			modelVersion,
			{ input },
		)) as number[][];

		// CLIP model may return different formats, handle both
		let embedding: number[];

		if (Array.isArray(output) && output.length > 0) {
			const first = output[0];

			// Check if it's an array of arrays (expected format)
			if (Array.isArray(first)) {
				embedding = first;
			}
			// Check if it's an object with an embedding property
			else if (typeof first === 'object' && first !== null) {
				// Try common property names
				const embeddingData = (first as any).embedding || (first as any).embeddings || (first as any).features;
				if (Array.isArray(embeddingData)) {
					embedding = embeddingData;
				} else {
					throw new Error(`Unexpected output format: first element is object but no embedding array found. Keys: ${Object.keys(first).join(', ')}`);
				}
			}
			else {
				throw new Error(`Unexpected output format: first element is ${typeof first}`);
			}
		} else {
			throw new Error(`Invalid output: expected array with at least one element`);
		}

		// CLIP ViT-B/32 produces 768-dimensional embeddings
		const expectedDimension = 768;
		if (!embedding || embedding.length !== expectedDimension) {
			throw new Error(
				`Invalid embedding dimension: expected ${expectedDimension}, got ${embedding?.length}`,
			);
		}

		// Normalize for inner product optimization
		const normalized = normalizeVector(embedding);

		log.info(
			{
				dimension: normalized.length,
			},
			"Image embedding generated",
		);

		return normalized;
	} catch (error) {
		// Log detailed error information
		const errorDetails = {
			imageUrl,
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			// For Replicate ApiError, try to extract more details
			...(error && typeof error === 'object' ? {
				status: (error as any).status,
				statusText: (error as any).statusText,
				response: (error as any).response,
				request: (error as any).request,
			} : {}),
		};
		log.error(errorDetails, "Failed to generate image embedding");
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
				textLength: text.length,
			},
			"Text embedding generated",
		);

		return normalized;
	} catch (error) {
		// Log detailed error information
		const errorDetails = {
			textLength: text.length,
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			// For OpenAI errors, try to extract more details
			...(error && typeof error === 'object' ? {
				status: (error as any).status,
				statusText: (error as any).statusText,
				response: (error as any).response,
			} : {}),
		};
		log.error(errorDetails, "Failed to generate text embedding");
		throw error;
	}
}
