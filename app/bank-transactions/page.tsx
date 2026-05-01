import { StubPage } from "@/components/StubPage";

export default function BankTransactionsPage() {
  return (
    <StubPage
      title="Bank Transactions"
      blurb="Raw feed of every bank and card transaction."
      details={
        <>
          Today this is where the user manually triages categorizations.
          The proposed Tasks enhancement front-runs that work: the agent
          handles confident calls automatically, and only surfaces the
          genuinely ambiguous ones into Tasks for review.
        </>
      }
    />
  );
}
