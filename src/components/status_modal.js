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
      dialogClassName="rounded-4 shadow-lg"
    >
      <Modal.Header closeButton className={style.header}>
        <Modal.Title className="fw-bold fs-5 text-center w-100">{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-center fs-6" style={{ minHeight: "60px" }}>
        {message}
      </Modal.Body>

      <Modal.Footer className="justify-content-center">
        <Button
          variant={style.button}
          onClick={onHide}
          className="px-4 py-2 fw-semibold rounded-3"
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StatusModal;
