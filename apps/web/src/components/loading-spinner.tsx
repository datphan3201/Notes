import { LoaderCircle } from "lucide-react";

export default function LoadingSpinner({ label }: { label: string }) {
    return (
        <div className="loading-indicator" role="status" aria-label={label}>
            <LoaderCircle className="loading-spinner" aria-hidden="true" />
        </div>
    );
}
