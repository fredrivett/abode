import { BarChart3, HardDrive, Image } from "lucide-react";
import { formatBytesParts } from "@/lib/utils";

type Props = {
  storageUsedBytes: bigint;
  itemCount: number;
};

export function AccountStats({ storageUsedBytes, itemCount }: Props) {
  const storage = formatBytesParts(storageUsedBytes);

  return (
    <section className="rounded-xl border p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <BarChart3 className="size-5 text-muted-foreground" />
        Account
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account usage and storage.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <Image className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {itemCount.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              {itemCount === 1 ? "Item" : "Items"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {storage.value}
              <span className="text-base font-normal small-caps">
                {storage.unit}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">Storage used</p>
          </div>
        </div>
      </div>
    </section>
  );
}
