import React, { useState, useEffect } from "react";
import "./css/student-information.css";

const StudentInformation = () => {
  const [students, setStudents] = useState([
    {
      student_id: 1,
      lrn: "123456789012", 
      first_name: "John",
      middle_name: "M",
      last_name: "Doe",
      extension_name: "Jr.",
      date_of_birth: "2005-03-15",
      gender: "Male",
      street: "123 Main St",
      city: "Trinidad",
      province: "Bohol",
      zip_code: "6300",
      guardian_name: "Michael Doe",
      contact_number: "+63 912 345 6789",
      created_at: "2024-04-01T12:00:00Z", 
      updated_at: "2024-04-01T12:00:00Z",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState("All");
  const [dobFilter, setDobFilter] = useState("");
  const [visibleStudents, setVisibleStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });

  useEffect(() => {
    let filtered = students.filter((student) => {
      const fullName = `${student.first_name} ${student.middle_name} ${student.last_name}`.toLowerCase();
      const matchSearch = fullName.includes(searchTerm.toLowerCase()) || student.LRN.includes(searchTerm);
      const matchGender = genderFilter === "All" || student.gender === genderFilter;
      const matchDob = dobFilter ? student.date_of_birth.includes(dobFilter) : true;
      return matchSearch && matchGender && matchDob;
    });

    if (sortConfig.key) {
      filtered = filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setVisibleStudents(filtered);
  }, [searchTerm, genderFilter, dobFilter, students, sortConfig]);


  const totalPages = Math.ceil(visibleStudents.length / studentsPerPage);
  const currentStudents = visibleStudents.slice(
    (currentPage - 1) * studentsPerPage,
    currentPage * studentsPerPage
  );


  return (
    <div className="flex justify-center items-center min-h-screen m-6 bg-gray-100">
      <div className="flex justify-center items-center student-information-table">
        <div className="filtration-container">
          <input
            placeholder="Search by name or LRN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-4 py-2 rounded w-full md:w-1/4"
          />
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="border px-4 py-2 rounded w-full md:w-1/4"
          >
            <option value="All">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <input
            type="date"
            value={dobFilter}
            onChange={(e) => setDobFilter(e.target.value)}
            className="border px-4 py-2 rounded w-full md:w-1/4"
          />
          <select
            onChange={(e) =>
              setSortConfig({
                key: e.target.value,
                direction: sortConfig.direction,
              })
            }
            className="border px-4 py-2 rounded"
          >
            <option value="last_name">Sort by Last Name</option>
            <option value="first_name">Sort by First Name</option>
            <option value="middle_name">Sort by Middle Name</option>
            <option value="date_of_birth">Sort by Date of Birth</option>
            <option value="gender">Sort by Gender</option>
          </select>
          <select
            onChange={(e) =>
              setSortConfig({
                key: sortConfig.key,
                direction: e.target.value,
              })
            }
            className="border px-4 py-2 rounded"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div className="overflow-auto m-6 rounded-lg shadow-md w-full">
          <table className="min-w-full bg-white text-sm text-left mx-auto border border-gray-300">
            <thead className="bg-gray-200 border-b border-gray-300">
              <tr>
                <th className="px-3 py-2 border">LRN</th>
                <th className="px-3 py-2 border">Last Name</th>
                <th className="px-3 py-2 border">First Name</th>
                <th className="px-3 py-2 border">Middle Name</th>
                <th className="px-3 py-2 border">Gender</th>
                <th className="px-3 py-2 border">Date of Birth</th>
                <th className="px-3 py-2 border">Guardian</th>
                <th className="px-3 py-2 border">Contact</th>
                <th className="px-3 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentStudents.map((student) => (
                <tr key={student.student_id} className="border-b">
                  <td className="px-3 py-2 border">{student.lrn}</td>
                  <td className="px-3 py-2 border">{student.last_name}</td>
                  <td className="px-3 py-2 border">{student.first_name}</td>
                  <td className="px-3 py-2 border">{student.middle_name}</td>
                  <td className="px-3 py-2 border">{student.gender}</td>
                  <td className="px-3 py-2 border">{student.date_of_birth}</td>
                  <td className="px-3 py-2 border">{student.guardian_name}</td>
                  <td className="px-3 py-2 border">{student.contact_number}</td>
                  <td className="px-3 py-2 border">
                    <button
                      className="btn btn-primary text-white py-1 px-3 mr-2"
                      onClick={() => alert()}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-secondary text-white py-1 px-3 mr-2"
                      onClick={() => alert("View Records")}
                    >
                      Records
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination mt-4 flex justify-center">
            <button
              className="border py-2 px-4 rounded-l bg-gray-200 hover:bg-gray-300"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="px-4 py-2">{currentPage}</span>
            <button
              className="border py-2 px-4 rounded-r bg-gray-200 hover:bg-gray-300"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentInformation;
