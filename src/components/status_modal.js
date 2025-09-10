import React from 'react';

import {
  Button,
  Modal,
} from 'react-bootstrap';

const VARIANT_STYLES = {
  primary: { header: "bg-primary text-white", button: "primary", closeVariant: "white" },
  success: { header: "bg-success text-white", button: "success", closeVariant: "white" },
  danger:  { header: "bg-danger text-white",  button: "danger",  closeVariant: "white" },
  warning: { header: "bg-warning text-dark",  button: "warning", closeVariant: undefined },
};

export default function StatusModal({
  show,
  // Accept both onHide and onClose for compatibility with your pages
  onHide,
  onClose,
  title,
  message,
  variant = "primary",

  // Controls (safe-mode friendly)
  dismissible = true,          // show X button & allow programmatic close
  allowBackdropClose = true,   // clicking outside closes if true
  allowEscClose = true,        // pressing Esc closes if true

  centered = true,
  size = "md",
  footer,                      // optional custom footer ReactNode
  className = "rounded-3 shadow",
}) {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const handleHide = onHide || onClose || (() => {});

  // Map controls to react-bootstrap props
  const backdropProp = dismissible
    ? (allowBackdropClose ? true : "static")
    : "static";

  const keyboardProp = dismissible
    ? !!allowEscClose
    : false;

  return (
    <Modal
      show={show}
      onHide={handleHide}
      centered={centered}
      size={size}
      backdrop={backdropProp}
      keyboard={keyboardProp}
      restoreFocus
      enforceFocus
      animation
      className={className}
    >
      <Modal.Header
        closeButton={dismissible}
        closeVariant={style.closeVariant}
        className={`${style.header} rounded-top-3`}
      >
        <Modal.Title className="fw-semibold fs-5 w-100 text-center">
          {title}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-center fs-6 text-secondary">
        {typeof message === "string" ? <p className="mb-0">{message}</p> : message}
      </Modal.Body>

      <Modal.Footer className="justify-content-center">
        {footer ?? (
          <Button variant={style.button} onClick={handleHide} className="px-4 fw-semibold">
            Close
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
