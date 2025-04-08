import React, { useState, useMemo } from "react";
import "./style/student_info.css"; 
import { Link } from "react-router-dom";
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

const Student_Info = () => {
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
    {
      student_id: 2,
      LRN: "987654321",
      first_name: "Jane",
      middle_name: "A",
      last_name: "Smith",
      extension_name: "Sr.",
      date_of_birth: "2006-06-22",
      gender: "Female",
      address: "456 Elm St, Bacolod",
      guardian_name: "Susan Smith",
      contact_number: "+63 912 234 5678",
      created_at: "2024-03-28",
    },
    {
      student_id: 3,
      LRN: "567891234",
      first_name: "Carlos",
      middle_name: "B",
      last_name: "Reyes",
      extension_name: "II",
      date_of_birth: "2005-11-10",
      gender: "Male",
      address: "789 Oak St, Cebu City",
      guardian_name: "Lydia Reyes",
      contact_number: "+63 912 678 1234",
      created_at: "2024-02-15",
    },
    {
      student_id: 4,
      LRN: "112233445",
      first_name: "Maria",
      middle_name: "C",
      last_name: "Lopez",
      extension_name: "",
      date_of_birth: "2005-08-30",
      gender: "Female",
      address: "321 Pine St, Davao",
      guardian_name: "Carlos Lopez",
      contact_number: "+63 912 567 4321",
      created_at: "2024-01-05",
    },
    {
      student_id: 5,
      LRN: "334455667",
      first_name: "David",
      middle_name: "D",
      last_name: "Martinez",
      extension_name: "",
      date_of_birth: "2004-12-14",
      gender: "Male",
      address: "654 Cedar St, Makati",
      guardian_name: "Isabel Martinez",
      contact_number: "+63 912 123 4321",
      created_at: "2024-03-02",
    },
    {
      student_id: 6,
      LRN: "778899001",
      first_name: "Eva",
      middle_name: "E",
      last_name: "Gonzalez",
      extension_name: "III",
      date_of_birth: "2006-05-12",
      gender: "Female",
      address: "987 Maple St, Quezon City",
      guardian_name: "Fernando Gonzalez",
      contact_number: "+63 912 890 1234",
      created_at: "2024-03-25",
    },
    {
      student_id: 7,
      LRN: "223344556",
      first_name: "Luis",
      middle_name: "F",
      last_name: "Santos",
      extension_name: "",
      date_of_birth: "2004-02-17",
      gender: "Male",
      address: "159 Birch St, Taguig",
      guardian_name: "Ana Santos",
      contact_number: "+63 912 432 5678",
      created_at: "2024-02-10",
    },
    {
      student_id: 8,
      LRN: "998877665",
      first_name: "Sofia",
      middle_name: "G",
      last_name: "Vega",
      extension_name: "",
      date_of_birth: "2005-09-25",
      gender: "Female",
      address: "753 Willow St, Pasig",
      guardian_name: "Nina Vega",
      contact_number: "+63 912 876 5432",
      created_at: "2024-04-05",
    },
    {
      student_id: 9,
      LRN: "101112131",
      first_name: "Marco",
      middle_name: "H",
      last_name: "Diaz",
      extension_name: "",
      date_of_birth: "2005-04-03",
      gender: "Male",
      address: "246 Chestnut St, Manila",
      guardian_name: "Eduardo Diaz",
      contact_number: "+63 912 345 1234",
      created_at: "2024-01-12",
    },
    {
      student_id: 10,
      LRN: "131415161",
      first_name: "Isabella",
      middle_name: "I",
      last_name: "Perez",
      extension_name: "IV",
      date_of_birth: "2006-01-29",
      gender: "Female",
      address: "852 Birch St, Iloilo",
      guardian_name: "Roberta Perez",
      contact_number: "+63 912 765 4321",
      created_at: "2024-03-18",
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
    <div className="student_info">
      <div className="title-container">
          <h1>Student Information</h1>
      </div>
      <div className="student_info-container">
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

          <Link to="/add_Student">
          <button className="add-student-btn">
          <FaPlus /> Add Student
            </button>
          </Link>

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

export default Student_Info;
