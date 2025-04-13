import React, { useState, useEffect } from "react";

const StudentInformation = () => {
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
    const [searchTerm, setSearchTerm] = useState("");
    const [genderFilter, setGenderFilter] = useState("All");
    const [dobFilter, setDobFilter] = useState("");
    const [visibleStudents, setVisibleStudents] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const studentsPerPage = 10;
    const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });
  
    const [showModal, setShowModal] = useState(false); 
    const [newStudent, setNewStudent] = useState({
      LRN: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      gender: "Male",
      date_of_birth: "",
      guardian_name: "",
      contact_number: "",
    });
  
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
  
    const hideStudent = (id) => {
      setStudents((prevStudents) => prevStudents.filter((s) => s.student_id !== id));
    };
  
    const totalPages = Math.ceil(visibleStudents.length / studentsPerPage);
    const currentStudents = visibleStudents.slice(
      (currentPage - 1) * studentsPerPage,
      currentPage * studentsPerPage
    );
  
    const handleAddStudent = () => {
      
        const { LRN, first_name, middle_name, last_name, gender, date_of_birth, guardian_name, contact_number } = newStudent;
      
     
        if (!LRN || !first_name || !last_name || !gender || !date_of_birth || !guardian_name || !contact_number) {
          alert("Please fill in all fields.");
          return; 
        }
    
        if (isNaN(contact_number)) {
          alert("Please enter a valid contact number.");
          return;
        }
      
   
        if (isNaN(LRN)) {
          alert("LRN must be a valid number.");
          return;
        }
      
     
        setStudents((prevStudents) => [
          ...prevStudents,
          {
            student_id: students.length + 1,
            ...newStudent,
            created_at: new Date().toISOString(),
          },
        ]);
      
        setShowModal(false);
      
  
        setNewStudent({
          LRN: "",
          first_name: "",
          middle_name: "",
          last_name: "",
          gender: "Male",
          date_of_birth: "",
          guardian_name: "",
          contact_number: "",
        });
      };
      
  
    return (
      <div className="flex justify-center items-center min-h-screen m-6 bg-gray-100">
        <div className=" flex justify-center items-center m-6">
          <div className="flex gap-6 justify-center">
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
  
            <button
              className="btn btn-primary text-white bold"
              onClick={() => setShowModal(true)}
            >
              Add Student
            </button>
          </div>
  
  
          <div className="overflow-auto rounded-lg shadow-md w-full">
            <table className="min-w-full bg-white text-sm text-left mx-auto">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-4 py-3">LRN</th>
                  <th className="px-4 py-3">Last Name</th>
                  <th className="px-4 py-3">First Name</th>
                  <th className="px-4 py-3">Middle Name</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">Date of Birth</th>
                  <th className="px-4 py-3">Guardian</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.map((student) => (
                  <tr key={student.student_id} className="border-b">
                    <td className="px-4 py-3">{student.LRN}</td>
                    <td className="px-4 py-3">{student.last_name}</td>
                    <td className="px-4 py-3">{student.first_name}</td>
                    <td className="px-4 py-3">{student.middle_name}</td>
                    <td className="px-4 py-3">{student.gender}</td>
                    <td className="px-4 py-3">{student.date_of_birth}</td>
                    <td className="px-4 py-3">{student.guardian_name}</td>
                    <td className="px-4 py-3">{student.contact_number}</td>
                    <td className="px-4 py-3">
                      <button
                        className="btn btn-primary text-white py-1 px-3 rounded hover:bg-blue-600 mr-2"
                        onClick={() => alert("View Info")}
                      >
                        View Info
                      </button>
                      <button
                        className="btn btn-secondary text-white py-1 px-3 rounded hover:bg-green-600 mr-2"
                        onClick={() => alert("View Records")}
                      >
                        View Records
                      </button>
                      <button
                        className="btn btn-danger text-white py-1 px-3 rounded hover:bg-red-600"
                        onClick={() => hideStudent(student.student_id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
  
         
          <div className="flex justify-center items-center mt-6">
            <button
              className="border py-2 px-4 rounded-l-md bg-gray-200 hover:bg-gray-300"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="px-4 py-2">{currentPage}</span>
            <button
              className="border py-2 px-4 rounded-r-md bg-gray-200 hover:bg-gray-300"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
  
  
<div className={`modal fade ${showModal ? "show d-block" : "d-none"}`} tabIndex="-1" aria-hidden={!showModal}>
  <div className="modal-dialog modal-dialog-centered">
    <div className="modal-content rounded-lg shadow-lg bg-white p-4">
      <div className="modal-header border-0 pb-3">
        <h5 className="modal-title text-xl font-semibold text-gray-900">Add Student</h5>
        <button type="button" className="btn-close" onClick={() => setShowModal(false)} aria-label="Close"></button>
      </div>
      <div className="modal-body">
        <form>
     
          <div className="mb-4">
            <label htmlFor="LRN" className="form-label text-gray-700 font-medium">LRN</label>
            <input
              type="text"
              id="LRN"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.LRN}
              onChange={(e) => setNewStudent({ ...newStudent, LRN: e.target.value })}
            />
          </div>
        
          <div className="mb-4">
            <label htmlFor="first_name" className="form-label text-gray-700 font-medium">First Name</label>
            <input
              type="text"
              id="first_name"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.first_name}
              onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
            />
          </div>
       
          <div className="mb-4">
            <label htmlFor="middle_name" className="form-label text-gray-700 font-medium">Middle Name</label>
            <input
              type="text"
              id="middle_name"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.middle_name}
              onChange={(e) => setNewStudent({ ...newStudent, middle_name: e.target.value })}
            />
          </div>
       
          <div className="mb-4">
            <label htmlFor="last_name" className="form-label text-gray-700 font-medium">Last Name</label>
            <input
              type="text"
              id="last_name"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.last_name}
              onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
            />
          </div>
      
          <div className="mb-4">
            <label htmlFor="gender" className="form-label text-gray-700 font-medium">Gender</label>
            <select
              id="gender"
              className="form-select px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.gender}
              onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
      
          <div className="mb-4">
            <label htmlFor="date_of_birth" className="form-label text-gray-700 font-medium">Date of Birth</label>
            <input
              type="date"
              id="date_of_birth"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.date_of_birth}
              onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })}
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="guardian_name" className="form-label text-gray-700 font-medium">Guardian Name</label>
            <input
              type="text"
              id="guardian_name"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.guardian_name}
              onChange={(e) => setNewStudent({ ...newStudent, guardian_name: e.target.value })}
            />
          </div>
     
          <div className="mb-4">
            <label htmlFor="contact_number" className="form-label text-gray-700 font-medium">Contact Number</label>
            <input
              type="text"
              id="contact_number"
              className="form-control px-4 py-2 rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStudent.contact_number}
              onChange={(e) => setNewStudent({ ...newStudent, contact_number: e.target.value })}
            />
          </div>
          
          <button 
            type="button" 
            className="btn btn-primary w-full py-2 px-4 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-300"
            onClick={handleAddStudent}
          >
            Add Student
          </button>
        </form>
      </div>
    </div>
  </div>
</div>

      </div>
    );
  };
  

export default StudentInformation;
