import React, { useState, useEffect } from "react";

const StudentModal = ({ 
  showModal, 
  setShowModal, 
  newStudent, 
  setNewStudent, 
  handleAddStudent, 
  handleUpdateStudent 
}) => {
  const isUpdate = newStudent.id !== null;  // Checks if the student has an id

  useEffect(() => {
    if (isUpdate) {
      // Make sure the fields are pre-filled correctly when the modal is opened for update
      setNewStudent({ ...newStudent });
    }
  }, [isUpdate, newStudent, setNewStudent]);

  const handleSave = () => {
    if (isUpdate) {
      handleUpdateStudent(newStudent); // Update student
    } else {
      handleAddStudent(newStudent); // Add new student
    }
    setShowModal(false); // Close modal after saving
  };

  return (
    <div className={`modal fade ${showModal ? "show d-block" : "d-none"}`} tabIndex="-1" aria-hidden={!showModal}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-3 shadow-lg bg-light p-4">
          <div className="modal-header border-0 pb-3">
            <h5 className="modal-title text-light center">
              {isUpdate ? "Update Student" : "Add New Student"}
            </h5>
          </div>
          <div className="modal-body">
            <form>
              <div className="grid grid-cols-2 gap-4">
                <input
                  className="form-control py-2 px-3 mb-3"
                  placeholder="LRN"
                  value={newStudent.LRN}
                  onChange={(e) => setNewStudent({ ...newStudent, LRN: e.target.value })}
                />
                <input
                  className="form-control py-2 px-3 mb-3"
                  placeholder="First Name"
                  value={newStudent.first_name}
                  onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                />
                <input
                  className="form-control py-2 px-3 mb-3"
                  placeholder="Middle Name"
                  value={newStudent.middle_name}
                  onChange={(e) => setNewStudent({ ...newStudent, middle_name: e.target.value })}
                />
                <input
                  className="form-control py-2 px-3 mb-3"
                  placeholder="Last Name"
                  value={newStudent.last_name}
                  onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                />
                <select
                  className="form-select py-2 px-3 mb-3"
                  value={newStudent.gender}
                  onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <input
                  className="form-control py-2 px-3 mb-3"
                  type="date"
                  value={newStudent.date_of_birth}
                  onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })}
                />
                <input
                  className="form-control py-2 px-3 mb-3"
                  placeholder="Guardian Name"
                  value={newStudent.guardian_name}
                  onChange={(e) => setNewStudent({ ...newStudent, guardian_name: e.target.value })}
                />
                <input
                  className="form-control py-2 px-3 mb-3"
                  placeholder="Contact Number"
                  value={newStudent.contact_number}
                  onChange={(e) => setNewStudent({ ...newStudent, contact_number: e.target.value })}
                />
              </div>
            </form>
          </div>
          <div className="modal-footer border-0 pt-3">
            <button
              type="button"
              className="btn btn-secondary py-2 px-4"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary py-2 px-4"
              onClick={handleSave}
            >
              {isUpdate ? "Update Student" : "Save Student"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentModal;
