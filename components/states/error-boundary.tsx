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
      return <UpgradePrompt className="m-3 md:m-6" />;
    }
    return (
      <div role="alert" className="panel m-3 max-w-lg p-7 md:m-6">
        <h2 className="flex items-center gap-3 text-xl leading-7 font-semibold">
          <span aria-hidden className="h-6 w-[3px] rounded-full bg-destructive" />
          This page couldn’t load
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
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
