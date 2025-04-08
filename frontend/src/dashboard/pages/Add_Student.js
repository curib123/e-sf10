import React, { useState, useMemo } from "react";
import "./style/add_student.css"; 
import { FaSearch, FaPlus, FaEdit, FaFileAlt, FaTrashAlt } from 'react-icons/fa';


const Select = ({ options, value, onChange, label }) => (
  <div className="filter">
    <label>{label}</label>
    <select value={value} onChange={onChange}>
      {options.map((option, index) => (
        <option key={index} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const Add_Student = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("All Gender");
  const [gradeLevelFilter, setGradeLevelFilter] = useState("All Grades");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [students, setStudents] = useState([
    {
      student_id: 1,
      LRN: "123456789",
      first_name: "John",
      middle_name: "M",
      last_name: "Doe",
      extension_name: "Jr.",
      date_of_birth: "2005-03-15",
      gender: "Male",
      address: "123 Main St, Trinidad",
      guardian_name: "Michael Doe",
      contact_number: "+63 912 345 6789",
      created_at: "2024-04-01",
    },
  ]);

  const [schoolRecords, setSchoolRecords] = useState([
    {
      record_id: 1,
      student_id: 1,
      academic_year: "2024-2025",
      grade_level: "7",
      sf10_document_path: "/documents/sf10_1.pdf",
      uploaded_by: "Admin",
      uploaded_at: "2024-04-01",
      is_deleted: false,
    },
  ]);

  const genderOptions = useMemo(() => ["All Gender", "Male", "Female"], []);
  const gradeLevelOptions = useMemo(() => ["All Grades", "7", "8", "9", "10"], []);
  const sortOrderOptions = useMemo(
    () => [
      { value: "asc", label: "Sort by Name (A-Z)" },
      { value: "desc", label: "Sort by Name (Z-A)" },
    ],
    []
  );

  const schoolRecordsMap = useMemo(() => {
    return schoolRecords.reduce((acc, record) => {
      acc[record.student_id] = record;
      return acc;
    }, {});
  }, [schoolRecords]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearchQuery =
        student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.middle_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.extension_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.LRN.includes(searchQuery);

      const matchesGenderFilter =
        genderFilter === "All Gender" || student.gender === genderFilter;

      const studentRecord = schoolRecordsMap[student.student_id];
      const studentGradeLevel = studentRecord ? studentRecord.grade_level : "N/A";

      const matchesGradeLevelFilter =
        gradeLevelFilter === "All Grades" || studentGradeLevel === gradeLevelFilter;

      return matchesSearchQuery && matchesGenderFilter && matchesGradeLevelFilter;
    });
  }, [students, searchQuery, genderFilter, gradeLevelFilter, schoolRecordsMap]);

  const sortedStudents = useMemo(() => {
    return filteredStudents.sort((a, b) => {
      const compareValue = sortOrder === "asc" ? 1 : -1;
      return a.first_name.localeCompare(b.first_name) * compareValue;
    });
  }, [filteredStudents, sortOrder]);

  const indexOfLastStudent = currentPage * itemsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - itemsPerPage;
  const currentStudents = sortedStudents.slice(indexOfFirstStudent, indexOfLastStudent);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="add-student">
      <div className="add-student-container">
        <div className="header">
          <div className="search-filters">
            <input
              type="text"
              className="search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FaSearch className="search-icon" />
            
            <Select
              options={genderOptions}
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              label="Gender"
            />
            
            <Select
              options={gradeLevelOptions}
              value={gradeLevelFilter}
              onChange={(e) => setGradeLevelFilter(e.target.value)}
              label="Grade Level"
            />
            
            <Select
              options={sortOrderOptions.map((opt) => opt.value)}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              label="Sort Order"
            />
          </div>
          <button className="add-student-btn">
            <FaPlus /> Add Student 
          </button>
        </div>

        <div className="crud-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>LRN</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Grade Level</th>
                <th>View Info</th>
                <th>School Record</th>
                <th>Edit</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {currentStudents.length > 0 ? (
                currentStudents.map((student) => {
                  const studentRecord = schoolRecordsMap[student.student_id];
                  return (
                    <tr key={student.student_id}>
                      <td>{student.student_id}</td>
                      <td>{student.LRN}</td>
                      <td>{student.first_name}</td>
                      <td>{student.middle_name}</td>
                      <td>{student.last_name}</td>
                      <td>{studentRecord ? studentRecord.grade_level : "N/A"}</td>
                      <td>
                        <button className="view-info-btn">
                          <FaFileAlt /> View Info
                        </button>
                      </td>
                      <td>
                        <button className="school-record-btn">
                          <FaFileAlt /> School Record
                        </button>
                      </td>
                      <td>
                        <button className="edit-btn">
                          <FaEdit /> Edit
                        </button>
                      </td>
                      <td>
                        <button className="remove-btn">
                          <FaTrashAlt /> {student.is_deleted ? "Restore" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="no-students">
                    No students found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
            Previous
          </button>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage * itemsPerPage >= sortedStudents.length}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Add_Student;
