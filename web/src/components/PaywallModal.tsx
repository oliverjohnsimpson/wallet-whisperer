import Modal from "@/components/ui/Modal";
import PlanCards from "@/components/PlanCards";

/** Shown when a user tries to use a feature above their tier. */
export default function PaywallModal({
  title = "Upgrade to unlock this",
  message,
  onClose,
}: {
  title?: string;
  message?: string;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} maxWidth="3xl">
      {message && <p className="mb-4 text-sm text-forest-light dark:text-night-muted">{message}</p>}
      <PlanCards compact />
    </Modal>
  );
}
