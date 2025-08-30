import React from "react";
import { Modal, Button } from "react-bootstrap";

const VARIANT_STYLES = {
  primary: { header: "bg-primary text-white", button: "primary" },
  success: { header: "bg-success text-white", button: "success" },
  danger: { header: "bg-danger text-white", button: "danger" },
  warning: { header: "bg-warning text-dark", button: "warning" },
};

const StatusModal = ({ show, onHide, title, message, variant = "primary" }) => {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      className="rounded-3 shadow"
    >
      <Modal.Header closeButton className={`${style.header} rounded-top-3`}>
        <Modal.Title className="fw-semibold fs-5 w-100 text-center">
          {title}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-center fs-6 text-secondary">
        {message}
      </Modal.Body>

      <Modal.Footer className="justify-content-center">
        <Button
          variant={style.button}
          onClick={onHide}
          className="px-4 fw-semibold"
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StatusModal;
