import { Coins01Icon } from "@hugeicons/core-free-icons";
import { card } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import type { Customer } from "@/lib/shops";
import { num } from "@/lib/format";


/** Who was just scanned and what they have left, for checking the name against the person in front of you */
export function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <div className={`${card} flex items-center justify-between gap-3 p-4`}>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-foreground">{customer.name}</p>
        <p className="truncate text-xs text-muted-foreground">{customer.buyer && customer.buyer !== customer.name ? `ซื้อโดย ${customer.buyer} · ${customer.phone}` : customer.phone}</p>
        <p className="truncate text-2xs text-muted-foreground">
          {customer.zone} · <span className="font-mono">{customer.ticketCode}</span>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xs text-muted-foreground">โทเคนบัตรใบนี้</p>
        <p className={`flex items-center justify-end gap-1 text-2xl font-semibold tabular-nums ${customer.tokens < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
          <Icon icon={Coins01Icon} className="size-5" />
          {num.format(customer.tokens)}
        </p>
      </div>
    </div>
  );
}
