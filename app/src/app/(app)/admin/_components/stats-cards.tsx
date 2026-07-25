"use client";

import { Box, HardDrive, Home, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";

type StatsCardsProps = {
  totals: {
    users: number;
    items: number;
    rooms: number;
    storageBytes: string;
  };
  embeddings?: {
    imageItems: number;
    withEmbeddings: number;
  };
};

export function StatsCards({ totals, embeddings }: StatsCardsProps) {
  const coveragePct =
    embeddings && embeddings.imageItems > 0
      ? Math.round((embeddings.withEmbeddings / embeddings.imageItems) * 100)
      : null;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Total Users</CardTitle>
          <Users className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {totals.users.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Total Items</CardTitle>
          <Box className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {totals.items.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Total Rooms</CardTitle>
          <Home className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {totals.rooms.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Storage Used</CardTitle>
          <HardDrive className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {formatBytes(BigInt(totals.storageBytes))}
          </div>
        </CardContent>
      </Card>

      {embeddings && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Image Embedding Coverage
            </CardTitle>
            <Sparkles className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {coveragePct === null ? "—" : `${coveragePct}%`}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              {embeddings.withEmbeddings.toLocaleString()} of{" "}
              {embeddings.imageItems.toLocaleString()} images
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
