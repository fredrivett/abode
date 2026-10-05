import {
  BarChart3,
  Files,
  HardDrive,
  Image,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatBytesParts } from "@/lib/utils";

type Props = {
  storageUsedBytes: bigint;
  itemCount: number;
  /** Stored files (uploads, scans, covers, saved images); null if unknown */
  fileCount: number | null;
};

export function AccountStats({
  storageUsedBytes,
  itemCount,
  fileCount,
}: Props) {
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

      <div
        className={`mt-4 grid gap-4 ${fileCount === null ? "md:grid-cols-2" : "md:grid-cols-3"}`}
      >
        <Stat
          icon={Image}
          value={itemCount.toLocaleString()}
          label={itemCount === 1 ? "Item" : "Items"}
        />
        {fileCount !== null && (
          <Stat
            icon={Files}
            value={fileCount.toLocaleString()}
            label={fileCount === 1 ? "File" : "Files"}
          />
        )}
        <Stat
          icon={HardDrive}
          value={
            <>
              {storage.value}
              <span className="small-caps font-normal text-base">
                {storage.unit}
              </span>
            </>
          }
          label="Storage used"
        />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-2xl tabular-nums">{value}</p>
        <p className="font-mono text-muted-foreground text-sm">{label}</p>
      </div>
    </div>
  );
}
