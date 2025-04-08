import React, { useState } from 'react';
import "./style/add_student.css";

const AddStudentForm = () => {
  const [studentData, setStudentData] = useState({
    LRN: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    extension_name: '',
    date_of_birth: '',
    gender: 'Male',
    address: '',
    guardian_name: '',
    contact_number: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudentData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting:', studentData);
    // TODO: send to backend or handle the data
  };

  return (
    <div className="body">

       <div className="add-student">
      <div className="add-student-container">

        <form onSubmit={handleSubmit} className="student-form" style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="search-filters" style={{ flexWrap: 'wrap' }}>
            <input type="text" name="LRN" placeholder="LRN" className="search-input" value={studentData.LRN} onChange={handleChange} required />
            <input type="text" name="first_name" placeholder="First Name" className="search-input" value={studentData.first_name} onChange={handleChange} required />
            <input type="text" name="middle_name" placeholder="Middle Name" className="search-input" value={studentData.middle_name} onChange={handleChange} />
            <input type="text" name="last_name" placeholder="Last Name" className="search-input" value={studentData.last_name} onChange={handleChange} required />
            <input type="text" name="extension_name" placeholder="Extension Name (e.g. Jr., III)" className="search-input" value={studentData.extension_name} onChange={handleChange} />
            <input type="date" name="date_of_birth" className="search-input" value={studentData.date_of_birth} onChange={handleChange} required />
            
            <select name="gender" className="filter-select" value={studentData.gender} onChange={handleChange}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            <input type="text" name="address" placeholder="Address" className="search-input" value={studentData.address} onChange={handleChange} required />
            <input type="text" name="guardian_name" placeholder="Guardian's Name" className="search-input" value={studentData.guardian_name} onChange={handleChange} required />
            <input type="tel" name="contact_number" placeholder="Contact Number" className="search-input" value={studentData.contact_number} onChange={handleChange} required />
          </div>

          <button type="submit" className="add-student-btn">Add Student</button>
        </form>
      </div>
    </div>
    </div>
  );
};

export default AddStudentForm;
