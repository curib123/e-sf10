import React, { useState } from "react";
import "./style/add_student.css"; // Import the CSS file
import { FaSearch, FaPlus, FaEdit, FaFileAlt, FaTrashAlt } from 'react-icons/fa'; // Import React Icons

const Add_Student = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("All Gender");
  const [gradeLevelFilter, setGradeLevelFilter] = useState("All Grades");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1); // New state for current page
  const itemsPerPage = 10; // Set number of items per page

  // Dummy data for students' personal information
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
    {
      student_id: 2,
      LRN: "987654321",
      first_name: "Jane",
      middle_name: "A",
      last_name: "Smith",
      extension_name: "Sr.",
      date_of_birth: "2004-08-22",
      gender: "Female",
      address: "456 Oak St, Trinidad",
      guardian_name: "Linda Smith",
      contact_number: "+63 912 345 6780",
      created_at: "2024-03-28",
    },
    {
      student_id: 3,
      LRN: "112233445",
      first_name: "Emily",
      middle_name: "L",
      last_name: "Brown",
      extension_name: "",
      date_of_birth: "2006-02-05",
      gender: "Female",
      address: "789 Pine St, Bohol",
      guardian_name: "David Brown",
      contact_number: "+63 912 345 6781",
      created_at: "2024-03-30",
    },
    {
      student_id: 4,
      LRN: "556677889",
      first_name: "Michael",
      middle_name: "R",
      last_name: "Williams",
      extension_name: "",
      date_of_birth: "2005-11-11",
      gender: "Male",
      address: "321 Maple St, Bohol",
      guardian_name: "Jessica Williams",
      contact_number: "+63 912 345 6782",
      created_at: "2024-03-27",
    },
    {
        student_id: 5,
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
      {
        student_id: 6,
        LRN: "987654321",
        first_name: "Jane",
        middle_name: "A",
        last_name: "Smith",
        extension_name: "Sr.",
        date_of_birth: "2004-08-22",
        gender: "Female",
        address: "456 Oak St, Trinidad",
        guardian_name: "Linda Smith",
        contact_number: "+63 912 345 6780",
        created_at: "2024-03-28",
      },
      {
        student_id: 7,
        LRN: "112233445",
        first_name: "Emily",
        middle_name: "L",
        last_name: "Brown",
        extension_name: "",
        date_of_birth: "2006-02-05",
        gender: "Female",
        address: "789 Pine St, Bohol",
        guardian_name: "David Brown",
        contact_number: "+63 912 345 6781",
        created_at: "2024-03-30",
      },
      {
        student_id: 8,
        LRN: "556677889",
        first_name: "Michael",
        middle_name: "R",
        last_name: "Williams",
        extension_name: "",
        date_of_birth: "2005-11-11",
        gender: "Male",
        address: "321 Maple St, Bohol",
        guardian_name: "Jessica Williams",
        contact_number: "+63 912 345 6782",
        created_at: "2024-03-27",
      },
      {
        student_id: 9,
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
      {
        student_id: 10,
        LRN: "987654321",
        first_name: "Jane",
        middle_name: "A",
        last_name: "Smith",
        extension_name: "Sr.",
        date_of_birth: "2004-08-22",
        gender: "Female",
        address: "456 Oak St, Trinidad",
        guardian_name: "Linda Smith",
        contact_number: "+63 912 345 6780",
        created_at: "2024-03-28",
      },
      {
        student_id: 11,
        LRN: "112233445",
        first_name: "Emily",
        middle_name: "L",
        last_name: "Brown",
        extension_name: "",
        date_of_birth: "2006-02-05",
        gender: "Female",
        address: "789 Pine St, Bohol",
        guardian_name: "David Brown",
        contact_number: "+63 912 345 6781",
        created_at: "2024-03-30",
      },
      {
        student_id: 12,
        LRN: "556677889",
        first_name: "Michael",
        middle_name: "R",
        last_name: "Williams",
        extension_name: "",
        date_of_birth: "2005-11-11",
        gender: "Male",
        address: "321 Maple St, Bohol",
        guardian_name: "Jessica Williams",
        contact_number: "+63 912 345 6782",
        created_at: "2024-03-27",
      },
  ]);

  // Dummy data for school records
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
    {
      record_id: 2,
      student_id: 2,
      academic_year: "2024-2025",
      grade_level: "8",
      sf10_document_path: "/documents/sf10_2.pdf",
      uploaded_by: "Admin",
      uploaded_at: "2024-03-28",
      is_deleted: false,
    },
    {
      record_id: 3,
      student_id: 3,
      academic_year: "2024-2025",
      grade_level: "9",
      sf10_document_path: "/documents/sf10_3.pdf",
      uploaded_by: "Admin",
      uploaded_at: "2024-03-30",
      is_deleted: false,
    },
    {
      record_id: 4,
      student_id: 4,
      academic_year: "2024-2025",
      grade_level: "10",
      sf10_document_path: "/documents/sf10_4.pdf",
      uploaded_by: "Admin",
      uploaded_at: "2024-03-27",
      is_deleted: false,
    },
  ]);

  // Dynamic states for dropdown options
  const [genderOptions, setGenderOptions] = useState(["All Gender", "Male", "Female"]);
  const [gradeLevelOptions, setGradeLevelOptions] = useState([
    "All Grades",
    "7",
    "8",
    "9",
    "10",
  ]);
  const [sortOrderOptions, setSortOrderOptions] = useState([
    { value: "asc", label: "Sort by Name (A-Z)" },
    { value: "desc", label: "Sort by Name (Z-A)" },
  ]);

  // Filter students based on search query, gender, grade level, and date of birth
  const filteredStudents = students.filter((student) => {
    const matchesSearchQuery =
      student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.middle_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.extension_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGenderFilter =
      genderFilter === "All Gender" || student.gender === genderFilter;

    // Match grade level using the student’s associated grade level from schoolRecords
    const studentRecord = schoolRecords.find(
      (record) => record.student_id === student.student_id
    );
    const studentGradeLevel = studentRecord ? studentRecord.grade_level : "N/A";

    const matchesGradeLevelFilter =
      gradeLevelFilter === "All Grades" || studentGradeLevel === gradeLevelFilter;

    return (
      matchesSearchQuery &&
      matchesGenderFilter &&
      matchesGradeLevelFilter
    );
  });

  // Sorting function for students based on first_name or last_name
  const sortStudents = (studentsList) => {
    return studentsList.sort((a, b) => {
      const compareValue = sortOrder === "asc" ? 1 : -1;
      return a.first_name.localeCompare(b.first_name) * compareValue;
    });
  };

  // Combine student data with their school records (including grade level)
  const studentsWithRecords = filteredStudents.map((student) => {
    const schoolRecord = schoolRecords.find(
      (record) => record.student_id === student.student_id
    );
    return {
      ...student,
      gradeLevel: schoolRecord ? schoolRecord.grade_level : "N/A",
    };
  });

  // Apply sorting
  const sortedStudents = sortStudents(studentsWithRecords);

  // Paginate the sortedStudents array
  const indexOfLastStudent = currentPage * itemsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - itemsPerPage;
  const currentStudents = sortedStudents.slice(indexOfFirstStudent, indexOfLastStudent);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="add-student">
      <div className="add-student-container">
    
        {/* Search Bar and Filters */}
        <div className="header">
          <div className="search-filters">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FaSearch className="search-icon" /> {/* Added Search Icon */}
            <select
              className="filter-select"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              {genderOptions.map((gender, index) => (
                <option key={index} value={gender}>
                  {gender}
                </option>
              ))}
            </select>

            {/* Dynamic Grade Level Dropdown */}
            <select
              className="filter-select"
              value={gradeLevelFilter}
              onChange={(e) => setGradeLevelFilter(e.target.value)}
            >
              {gradeLevelOptions.map((grade, index) => (
                <option key={index} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>
            {/* Dynamic Sort Order Dropdown */}
            <select
              className="filter-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              {sortOrderOptions.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button className="add-student-btn">
            <FaPlus /> Add Student {/* Added Add Icon */}
          </button>
        </div>

        {/* Student Table */}
        <div className="crud-table">
          {currentStudents.length > 0 ? (
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
                {currentStudents.map((student) => (
                  <tr key={student.student_id}>
                    <td>{student.student_id}</td>
                    <td>{student.LRN}</td>
                    <td>{student.first_name}</td>
                    <td>{student.middle_name}</td>
                    <td>{student.last_name}</td>
                    <td>{student.gradeLevel}</td>
                    <td>
                      <button className="view-info-btn">
                        <FaFileAlt /> View Info {/* Added View Info Icon */}
                      </button>
                    </td>
                    <td>
                      <button className="school-record-btn">
                        <FaFileAlt /> School Record {/* Added School Record Icon */}
                      </button>
                    </td>
                    <td>
                      <button className="edit-btn">
                        <FaEdit /> Edit {/* Added Edit Icon */}
                      </button>
                    </td>
                    <td>
                      <button
                        className="remove-btn"
                      >
                        <FaTrashAlt /> {student.is_deleted ? "Restore" : "Remove"} {/* Toggle Delete */}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>No students found.</div>
          )}
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
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
