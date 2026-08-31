import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TopSpender } from "@/lib/admin/usage-stats";
import { formatUsd } from "@/lib/utils";

type TopSpendersTableProps = {
  spenders: TopSpender[];
};

function displayName(spender: TopSpender): string {
  const name = `${spender.firstName ?? ""} ${spender.lastName ?? ""}`.trim();
  return name || spender.username || spender.email;
}

export function TopSpendersTable({ spenders }: TopSpendersTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Top Spenders (This Month){" "}
          <span className="font-normal text-muted-foreground text-xs">UTC</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Spend (month)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spenders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground"
                >
                  No spend yet this month
                </TableCell>
              </TableRow>
            ) : (
              spenders.map((spender, index) => (
                <TableRow key={spender.userId}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/users/${spender.userId}`}
                      className="hover:underline"
                    >
                      {displayName(spender)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(spender.monthCostUsd)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
