import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { EXPORT_ROOT_SELECTS } from "./select";

/**
 * Guardrail: the data export promises "everything you've built up". Every
 * column on a model the export reads — and every relation off the user and
 * their items — must be either exported (selected in `./select`) or excluded
 * here with a reason. A new column fails this test until someone decides.
 */

const ROW_BOOKKEEPING = "row bookkeeping: implied by the export's structure";
const STORAGE_KEY = "internal storage path; files come in a later export phase";

const EXCLUDED_FIELDS: Record<string, string> = {
  // User — account internals, and other people's data
  "User.id": "internal id",
  "User.isAdmin": "internal role",
  "User.storageUsedBytes": "derived counter",
  "User.itemCount": "derived counter",
  "User.updatedAt": ROW_BOOKKEEPING,
  "User.onboardingCompletedAt": "onboarding state",
  "User.referredById": "another user's id",
  "User.inviteAllocation": "invite quota",
  "User.origin": "how the account was granted access",
  "User.referredBy": "another user's account",
  "User.referrals": "other users' accounts",
  "User.sentInvites": "other people's email addresses",
  "User.items": "exported as items[] (read separately, in batches)",
  "User.rooms": "exported as rooms[] (read separately)",
  "User.noteDraft": "exported as noteDraft (read separately)",
  "User.locations": "exported per item",
  "User.articleHighlights": "exported per item",
  "User.visualVectors": "embeddings: model-specific, not portable",
  "User.textVectors": "embeddings: model-specific, not portable",
  "User.mediaAnalyses": "analysis cache",
  "User.activityLogs": "account activity: later export phase",
  "User.itemImports": "import job history",
  "User.milestones": "onboarding checklist state",
  "User.usageDaily": "cost-limit internals",
  "User.personalAccessTokens": "credentials",
  "User.dataExports": "export job history",

  "NoteDraft.userId": ROW_BOOKKEEPING,
  "NoteDraft.user": ROW_BOOKKEEPING,

  "Room.userId": ROW_BOOKKEEPING,
  "Room.user": ROW_BOOKKEEPING,
  "Room.embedReferrers": "third-party sites embedding a public room",
  "RoomItem.id": ROW_BOOKKEEPING,
  "RoomItem.roomId": ROW_BOOKKEEPING,
  "RoomItem.room": ROW_BOOKKEEPING,
  "RoomItem.item": ROW_BOOKKEEPING,

  // Item — pipeline internals and storage keys
  "Item.userId": ROW_BOOKKEEPING,
  "Item.user": ROW_BOOKKEEPING,
  "Item.processingStatus": "capture pipeline state",
  "Item.processingStartedAt": "capture pipeline state",
  "Item.processingError": "capture pipeline state",
  "Item.captureLevel": "capture pipeline state",
  "Item.lastReassignedAt": "rate-limit bookkeeping",
  "Item.personalAccessTokenId":
    "which credential saved it; captureSource already says it came via the API",
  "Item.personalAccessToken": "credential",
  "Item.fileKey": STORAGE_KEY,
  "Item.coverFileKey": STORAGE_KEY,
  "Item.faviconFileKey": STORAGE_KEY,
  "Item.roomItems": "exported as rooms[].items",
  "Item.visualVectors": "embeddings: model-specific, not portable",
  "Item.textVectors": "embeddings: model-specific, not portable",
  "Item.mediaAnalyses": "analysis cache",

  "ItemArticleDetails.itemId": ROW_BOOKKEEPING,
  "ItemArticleDetails.item": ROW_BOOKKEEPING,
  "ItemArticleDetails.createdAt": ROW_BOOKKEEPING,
  "ItemArticleDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemImageDetails.itemId": ROW_BOOKKEEPING,
  "ItemImageDetails.item": ROW_BOOKKEEPING,
  "ItemImageDetails.createdAt": ROW_BOOKKEEPING,
  "ItemImageDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemImageDetails.visionData": "raw vision API response",
  "ItemImageDetails.blurDataUrl": "render placeholder",
  "ItemTwitterDetails.itemId": ROW_BOOKKEEPING,
  "ItemTwitterDetails.item": ROW_BOOKKEEPING,
  "ItemTwitterDetails.createdAt": ROW_BOOKKEEPING,
  "ItemTwitterDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemTwitterDetails.authorAvatarFileKey": STORAGE_KEY,
  "ItemInstagramDetails.itemId": ROW_BOOKKEEPING,
  "ItemInstagramDetails.item": ROW_BOOKKEEPING,
  "ItemInstagramDetails.createdAt": ROW_BOOKKEEPING,
  "ItemInstagramDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemVideoDetails.itemId": ROW_BOOKKEEPING,
  "ItemVideoDetails.item": ROW_BOOKKEEPING,
  "ItemVideoDetails.createdAt": ROW_BOOKKEEPING,
  "ItemVideoDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemProductDetails.itemId": ROW_BOOKKEEPING,
  "ItemProductDetails.item": ROW_BOOKKEEPING,
  "ItemProductDetails.createdAt": ROW_BOOKKEEPING,
  "ItemProductDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemBookDetails.itemId": ROW_BOOKKEEPING,
  "ItemBookDetails.item": ROW_BOOKKEEPING,
  "ItemBookDetails.createdAt": ROW_BOOKKEEPING,
  "ItemBookDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemNoteDetails.itemId": ROW_BOOKKEEPING,
  "ItemNoteDetails.item": ROW_BOOKKEEPING,
  "ItemNoteDetails.createdAt": ROW_BOOKKEEPING,
  "ItemNoteDetails.updatedAt": ROW_BOOKKEEPING,
  "ItemDocumentPage.id": ROW_BOOKKEEPING,
  "ItemDocumentPage.itemId": ROW_BOOKKEEPING,
  "ItemDocumentPage.item": ROW_BOOKKEEPING,
  "ItemDocumentPage.createdAt": ROW_BOOKKEEPING,
  "ItemDocumentPage.updatedAt": ROW_BOOKKEEPING,
  "ItemDocumentPage.fileKey": STORAGE_KEY,
  "ItemDocumentPage.originalFileKey": STORAGE_KEY,
  "ItemLocation.id": ROW_BOOKKEEPING,
  "ItemLocation.itemId": ROW_BOOKKEEPING,
  "ItemLocation.item": ROW_BOOKKEEPING,
  "ItemLocation.userId": ROW_BOOKKEEPING,
  "ItemLocation.user": ROW_BOOKKEEPING,
  "ItemLocation.raw": "raw geocoding payload",
  "ItemLocation.createdAt": ROW_BOOKKEEPING,
  "ItemLocation.updatedAt": ROW_BOOKKEEPING,
  "ArticleHighlight.itemId": ROW_BOOKKEEPING,
  "ArticleHighlight.item": ROW_BOOKKEEPING,
  "ArticleHighlight.userId": ROW_BOOKKEEPING,
  "ArticleHighlight.user": ROW_BOOKKEEPING,
};

type Selection = Record<string, unknown>;

const isSelection = (value: unknown): value is Selection =>
  typeof value === "object" && value !== null && !Array.isArray(value);
type Model = (typeof Prisma.dmmf.datamodel.models)[number];

const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);

function model(name: string): Model {
  const found = models.get(name);
  if (!found) throw new Error(`Unknown model ${name}`);
  return found;
}

/** Every `Model.field` a select reads, following nested relation selects */
function selectedFields(modelName: string, select: Selection): string[] {
  const fields = new Map(model(modelName).fields.map((f) => [f.name, f]));
  return Object.entries(select).flatMap(([name, selection]) => {
    const field = fields.get(name);
    if (!field) throw new Error(`${modelName}.${name} isn't in the schema`);
    const id = `${modelName}.${name}`;
    if (
      field.kind === "object" &&
      isSelection(selection) &&
      isSelection(selection.select)
    ) {
      return [id, ...selectedFields(field.type, selection.select)];
    }
    return [id];
  });
}

const exported = new Set(
  Object.entries(EXPORT_ROOT_SELECTS).flatMap(([name, select]) =>
    selectedFields(name, select),
  ),
);

/** Models the export covers: its roots plus every model reached by a select */
const coveredModels = new Set(
  [...exported].map((id) => id.slice(0, id.indexOf("."))),
);

describe("data export coverage", () => {
  it("exports or explicitly excludes every column of every covered model", () => {
    const undecided = [...coveredModels].flatMap((name) =>
      model(name)
        .fields.map((field) => `${name}.${field.name}`)
        .filter((id) => !exported.has(id) && !(id in EXCLUDED_FIELDS)),
    );

    expect(
      undecided,
      "Decide whether each of these belongs in the data export: select it in " +
        "src/lib/export/select.ts, or add it to EXCLUDED_FIELDS with a reason.",
    ).toEqual([]);
  });

  it("covers every model related to the user or their items", () => {
    const related = ["User", "Item"].flatMap((name) =>
      model(name)
        .fields.filter((field) => field.kind === "object")
        .map((field) => ({ id: `${name}.${field.name}`, type: field.type })),
    );
    const uncovered = related
      .filter(
        ({ id, type }) => !coveredModels.has(type) && !(id in EXCLUDED_FIELDS),
      )
      .map(({ id }) => id);

    expect(uncovered).toEqual([]);
  });

  it("doesn't both export and exclude a field, or exclude one that's gone", () => {
    const allFields = new Set(
      [...models.values()].flatMap((m) =>
        m.fields.map((field) => `${m.name}.${field.name}`),
      ),
    );
    const contradictory = Object.keys(EXCLUDED_FIELDS).filter((id) =>
      exported.has(id),
    );
    const stale = Object.keys(EXCLUDED_FIELDS).filter(
      (id) => !allFields.has(id),
    );
    expect({ contradictory, stale }).toEqual({ contradictory: [], stale: [] });
  });
});
