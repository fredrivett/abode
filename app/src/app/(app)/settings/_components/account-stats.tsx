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
      <h3 className="flex items-center gap-2 font-semibold text-xl">
        <BarChart3 className="size-5 text-muted-foreground" />
        Account
      </h3>
      <p className="mt-1 font-mono text-muted-foreground text-sm">
        Your account usage and storage.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <Image className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-2xl tabular-nums">
              {itemCount.toLocaleString()}
            </p>
            <p className="font-mono text-muted-foreground text-sm">
              {itemCount === 1 ? "Item" : "Items"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-2xl tabular-nums">
              {storage.value}
              <span className="small-caps font-normal text-base">
                {storage.unit}
              </span>
            </p>
            <p className="font-mono text-muted-foreground text-sm">Storage used</p>
          </div>
        </div>
      </div>
    </section>
  );
}
