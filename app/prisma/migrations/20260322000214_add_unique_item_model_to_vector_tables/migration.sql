-- CreateIndex
CREATE UNIQUE INDEX "item_text_vectors_item_id_model_key" ON "item_text_vectors"("item_id", "model");

-- CreateIndex
CREATE UNIQUE INDEX "item_visual_vectors_item_id_model_key" ON "item_visual_vectors"("item_id", "model");
