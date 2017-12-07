extern "C" {
    fn make_42() -> i32;
}

#[no_mangle]
pub fn add_to_42(a: i32) -> i32 {
    let magic = unsafe { make_42() };
    magic + a
}
