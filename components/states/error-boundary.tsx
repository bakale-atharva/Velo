"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { errorCode, errorMessage } from "@/lib/errors";
import { UpgradePrompt } from "./upgrade-prompt";

type Props = { children: ReactNode };
type State = { error: unknown; hasError: boolean };

/**
 * Catches errors thrown while rendering (a Convex query that throws lands
 * here). Plan errors show the upgrade prompt; others a message and a retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, hasError: true };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    if (errorCode(this.state.error) === "FEATURE_NOT_IN_PLAN") {
      return <UpgradePrompt />;
    }
    return (
      <div role="alert" className="max-w-md border-t-4 border-destructive py-6">
        <h2 className="text-xl leading-6 font-semibold">This page couldn’t load</h2>
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
          {errorMessage(this.state.error)}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => this.setState({ error: null, hasError: false })}
        >
          Try again
        </Button>
      </div>
    );
  }
}
