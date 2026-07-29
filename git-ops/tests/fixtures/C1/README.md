# Ledger

A small double-entry ledger libary for internal reporting.

## Usage

    import { post } from "./src/ledger";
    post({ debit: "cash", credit: "revenue", amount: 250 });
